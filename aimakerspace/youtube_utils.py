import os
import shutil
import re
import logging
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
import asyncio
from urllib.parse import urlparse, parse_qs
import numpy as np

# constants
TEMP_AUDIO_DIR = "data/temp_audio"

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    # format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

try:
    import yt_dlp
except ImportError:
    print("yt-dlp not installed. Install with: pip install yt-dlp")
    yt_dlp = None

try:
    import whisper
except ImportError:
    print("whisper not installed. Install with: pip install openai-whisper")
    whisper = None


@dataclass
class VideoSegment:
    """Represents a segment of video content with timestamp and text."""
    start_time: float
    end_time: float
    text: str
    segment_id: str
    video_id: str
    video_title: str
    video_url: str


class YouTubeProcessor:
    """Handles YouTube video processing for RAG ingestion."""
    
    def __init__(self, whisper_model: str = "base", cleanup_audio: bool = False):
        """
        Initialize YouTube processor.
        
        Args:
            whisper_model: Whisper model size ('tiny', 'base', 'small', 'medium', 'large')
        """
        logger.info(f"Initializing YouTubeProcessor with Whisper model: {whisper_model}")
        self.whisper_model = whisper_model
        self.whisper = None
        if whisper:
            logger.debug(f"Loading Whisper model: {whisper_model}")
            self.whisper = whisper.load_model(whisper_model)
            logger.debug(f"Whisper model {whisper_model} loaded successfully")
        else:
            logger.warning("Whisper not available - transcription will not work")

        self.cleanup_audio = cleanup_audio

        # Make ffmpeg available to the Python process
        ffmpeg_path = shutil.which('ffmpeg')
        ffprobe_path = shutil.which('ffprobe')
        if ffmpeg_path and ffprobe_path:
            ffmpeg_dir = os.path.dirname(ffmpeg_path)
            ffprobe_dir = os.path.dirname(ffprobe_path)
            os.environ['PATH'] = ffmpeg_dir + ':' + ffprobe_dir + ':' + os.environ['PATH']
            logger.info(f"✅ ffmpeg available at: {ffmpeg_path}")
            logger.info(f"✅ ffprobe available at: {ffprobe_path}")
        else:
            logger.error("ffmpeg or ffprobe not available")
            raise ImportError("""
            ffmpeg or ffprobe is required to process YouTube videos. 
            Install both in your system and check your PATH environment variable.
            If using Python venv, make sure you activate it before opening your IDE andrunning the notebook!
            """)
    
    def extract_video_id(self, url: str) -> str:
        """Extract video ID from YouTube URL."""
        parsed_url = urlparse(url)
        
        if parsed_url.hostname in ['www.youtube.com', 'youtube.com']:
            if parsed_url.path == '/watch':
                return parse_qs(parsed_url.query)['v'][0]
            elif parsed_url.path.startswith('/embed/'):
                return parsed_url.path.split('/')[2]
            elif parsed_url.path.startswith('/v/'):
                return parsed_url.path.split('/')[2]
        elif parsed_url.hostname == 'youtu.be':
            return parsed_url.path[1:]
        
        raise ValueError(f"Could not extract video ID from URL: {url}")
    
    def get_video_info(self, url: str) -> Dict:
        """Get video metadata using yt-dlp."""
        if not yt_dlp:
            raise ImportError("yt-dlp is required. Install with: pip install yt-dlp")
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return {
                'id': info.get('id'),
                'title': info.get('title'),
                'duration': info.get('duration'),
                'uploader': info.get('uploader'),
                'description': info.get('description'),
                'url': url
            }
    
    def download_audio(self, url: str, output_path: str = None) -> str:
        """Download audio from YouTube video."""
        logger.info(f"Starting audio download for URL: {url}")

        if not yt_dlp:
            logger.error("yt-dlp is not installed")
            raise ImportError("yt-dlp is required. Install with: pip install yt-dlp")
        
        # Use default directory if None is provided
        if output_path is None:
            output_path = TEMP_AUDIO_DIR
        
        # Ensure output directory exists
        os.makedirs(output_path, exist_ok=True)
        
        # Get video info first to get the title
        logger.info("Extracting video metadata...")
        video_info = self.get_video_info(url)
        video_title = video_info.get('title', 'video')
        logger.info(f"Video title: {video_title}")
        
        # Clean filename for filesystem compatibility
        logger.debug("Cleaning filename for filesystem compatibility...")
        safe_title = re.sub(r'[^\w\s-]', '', video_title).strip()
        safe_title = re.sub(r'[-\s]+', '-', safe_title)
        logger.debug(f"Safe filename: {safe_title}")
        
        # Check if audio file already exists
        expected_wav_file = os.path.join(output_path, f"{safe_title}.wav")
        logger.debug(f"Checking if audio file already exists: {expected_wav_file}")
        
        if os.path.exists(expected_wav_file):
            logger.info(f"Audio file already exists, using existing file: {expected_wav_file}")
            return expected_wav_file
        
        # Also check for other audio formats that might exist
        audio_extensions = ['.wav', '.mp3', '.m4a', '.webm', '.ogg']
        for ext in audio_extensions:
            potential_file = os.path.join(output_path, f"{safe_title}{ext}")
            if os.path.exists(potential_file):
                logger.info(f"Audio file already exists, using existing file: {potential_file}")
                return potential_file
        
        logger.info("Audio file not found, proceeding with download...")
        
        logger.debug("Configuring yt-dlp options for audio download...")
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': f'{output_path}/{safe_title}.%(ext)s',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'wav',
                'preferredquality': '192',
            }],
            'quiet': True,
        }
        
        logger.info("Starting download with yt-dlp...")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            logger.info("Download completed successfully")
            
            # Get the actual downloaded filename from yt-dlp
            downloaded_file = ydl.prepare_filename(info)
            logger.debug(f"Expected downloaded file: {downloaded_file}")
            
            # If it's not a WAV file, look for the converted WAV file
            if not downloaded_file.endswith('.wav'):
                base_name = os.path.splitext(downloaded_file)[0]
                wav_file = base_name + '.wav'
                logger.debug(f"Looking for converted WAV file: {wav_file}")
                if os.path.exists(wav_file):
                    logger.debug(f"Found WAV file: {wav_file}")
                    return wav_file
            
            # Fallback: look for any audio file in the directory
            if os.path.exists(downloaded_file):
                logger.debug(f"Using downloaded file: {downloaded_file}")
                return downloaded_file
            
            # Last resort: search for any audio file
            logger.debug("Searching for audio files in output directory...")
            for file in os.listdir(output_path):
                if file.endswith(('.wav', '.mp3', '.m4a', '.webm', '.ogg')):
                    found_file = os.path.join(output_path, file)
                    logger.info(f"Found audio file: {found_file}")
                    return found_file
        
        logger.error("Audio file not found after download")
        raise FileNotFoundError("Audio file not found after download")
    
    def transcribe_audio(self, audio_path: str, save_to_file: bool = True, output_dir: str = None) -> List[Dict]:
        """Transcribe audio using Whisper and return segments with timestamps."""
        logger.info(f"Starting audio transcription for: {audio_path}")
        
        if not self.whisper:
            logger.error("Whisper model not loaded")
            raise ImportError("Whisper is required. Install with: pip install openai-whisper")
        
        logger.info(f"Transcribing with Whisper model: {self.whisper_model}")
        result = self.whisper.transcribe(audio_path, word_timestamps=True)
        logger.info("Whisper transcription completed")
        
        logger.info("Processing transcription segments...")
        segments = []
        for segment in result['segments']:
            segments.append({
                'start': segment['start'],
                'end': segment['end'],
                'text': segment['text'].strip()
            })
        
        logger.debug(f"Processed {len(segments)} transcription segments")
        
        # Save transcription to file if requested
        if save_to_file:
            logger.debug("Saving transcription to file...")
            self._save_transcription_to_file(segments, audio_path, output_dir)
        else:
            logger.debug("Skipping transcription file save")
        
        logger.info(f"Transcription completed successfully with {len(segments)} segments")
        return segments
    
    def _save_transcription_to_file(self, segments: List[Dict], audio_path: str, output_dir: str = None):
        """Save transcription segments to a text file."""
        # Use default directory if None is provided
        if output_dir is None:
            output_dir = TEMP_AUDIO_DIR
            
        logger.debug(f"Saving transcription file to directory: {output_dir}")
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate filename based on audio file
        audio_filename = os.path.splitext(os.path.basename(audio_path))[0]
        transcript_filename = f"{audio_filename}_transcript.txt.tmp"
        transcript_path = os.path.join(output_dir, transcript_filename)
        logger.debug(f"Writing transcription to: {transcript_path}")
        
        # Write transcription to file
        with open(transcript_path, 'w', encoding='utf-8') as f:
            f.write(f"Transcription for: {audio_filename}\n")
            f.write("=" * 50 + "\n\n")
            
            for i, segment in enumerate(segments, 1):
                start_time = self._format_timestamp(segment['start'])
                end_time = self._format_timestamp(segment['end'])
                f.write(f"[{start_time} - {end_time}] {segment['text']}\n")
            
            f.write(f"\n\nTotal segments: {len(segments)}\n")
            f.write(f"Total duration: {self._format_timestamp(segments[-1]['end']) if segments else '0:00'}\n")
        
        logger.debug(f"Transcription saved to: {transcript_path}")
    
    def _format_timestamp(self, seconds: float) -> str:
        """Format seconds into MM:SS format."""
        minutes = int(seconds // 60)
        seconds = int(seconds % 60)
        return f"{minutes:02d}:{seconds:02d}"
    
    def create_video_segments(
        self, 
        url: str, 
        chunk_duration: float = 40.0,
        overlap: float = 5.0
    ) -> List[VideoSegment]:
        """
        Create video segments from YouTube URL.
        
        Args:
            url: YouTube video URL
            chunk_duration: Duration of each segment in seconds
            overlap: Overlap between segments in seconds
        
        Returns:
            List of VideoSegment objects
        """
        logger.info(f"Creating video segments for: {url}")
        logger.debug(f"Chunk duration: {chunk_duration}s, Overlap: {overlap}s")
        
        # Get video info
        logger.debug("Getting video information...")
        video_info = self.get_video_info(url)
        video_id = video_info['id']
        logger.debug(f"Video ID: {video_id}")
        
        # Download audio
        logger.info("Downloading audio...")
        audio_path = self.download_audio(url)
        
        try:
            # Transcribe audio
            logger.info("Transcribing audio...")
            segments = self.transcribe_audio(audio_path)
            
            # Create video segments with chunking
            logger.debug("Creating video segments with chunking strategy...")
            video_segments = []
            current_start = 0
            
            while current_start < video_info['duration']:
                current_end = min(current_start + chunk_duration, video_info['duration'])
                
                # Find text for this time range
                segment_text = self._get_text_for_time_range(segments, current_start, current_end)
                
                if segment_text.strip():  # Only add non-empty segments
                    segment_id = f"{video_id}_{current_start:.1f}_{current_end:.1f}"
                    video_segments.append(VideoSegment(
                        start_time=current_start,
                        end_time=current_end,
                        text=segment_text,
                        segment_id=segment_id,
                        video_id=video_id,
                        video_title=video_info['title'],
                        video_url=url
                    ))
                
                current_start += chunk_duration - overlap
            
            logger.info(f"Created {len(video_segments)} video segments from transcription")
            return video_segments
            
        finally:
            # Clean up audio file
            if self.cleanup_audio:
                logger.debug("Cleaning up temporary audio file...")
                if os.path.exists(audio_path):
                    os.remove(audio_path)
                    logger.debug(f"Removed temporary file: {audio_path}")
                else:
                    logger.warning(f"Temporary file not found for cleanup: {audio_path}")
    
    def _get_text_for_time_range(self, segments: List[Dict], start: float, end: float) -> str:
        """Extract text for a specific time range from segments."""
        text_parts = []
        for segment in segments:
            if segment['start'] >= start and segment['end'] <= end:
                text_parts.append(segment['text'])
        return ' '.join(text_parts)
    
    def process_youtube_video(self, url: str, chunk_duration: float = 40.0) -> List[VideoSegment]:
        """
        Complete pipeline to process a YouTube video into segments.
        
        Args:
            url: YouTube video URL
            chunk_duration: Duration of each segment in seconds
        
        Returns:
            List of VideoSegment objects ready for vector database ingestion
        """
        return self.create_video_segments(url, chunk_duration)
    
    def get_video_segments(self, video_id: str, vector_db) -> List[Dict]:
        """Get all segments for a specific video from the vector database."""
        segments = []
        for key, metadata in vector_db.metadata.items():
            if metadata.get('video_id') == video_id:
                segments.append(metadata)
        
        return sorted(segments, key=lambda x: x.get('start_time', 0))
    
    async def ingest_youtube_video(
        self, 
        vector_db,
        url: str, 
        chunk_duration: float = 40.0
    ) -> Dict:
        """
        Complete pipeline to ingest a YouTube video into the vector database.
        
        Args:
            vector_db: VectorDatabase instance to ingest into
            url: YouTube video URL
            chunk_duration: Duration of each segment in seconds
        
        Returns:
            Dictionary with ingestion summary
        """
        logger.info(f"Starting YouTube video ingestion for: {url}")
        logger.info(f"Using chunk duration: {chunk_duration} seconds")
        
        # Process video
        segments = self.process_youtube_video(url, chunk_duration)
        
        # Generate embeddings for all segments
        texts = [segment.text for segment in segments]
        logger.debug(f"Processing {len(texts)} text segments for embedding generation")
        embeddings = await vector_db.embedding_model.async_get_embeddings(texts)
        logger.debug(f"Generated {len(embeddings)} embeddings successfully")
        
        # Insert into vector database with metadata
        logger.info("Inserting segments and embeddings into vector database...")
        for i, (segment, embedding) in enumerate(zip(segments, embeddings), 1):
            metadata = {
                'start_time': segment.start_time,
                'end_time': segment.end_time,
                'text': segment.text,
                'video_id': segment.video_id,
                'video_title': segment.video_title,
                'video_url': segment.video_url,
                'segment_id': segment.segment_id
            }
            vector_db.insert(segment.segment_id, np.array(embedding), metadata)
            if i % 10 == 0 or i == len(segments):  # Log progress every 10 segments
                logger.debug(f"Inserted {i}/{len(segments)} segments into vector database")
        
        result = {
            'video_id': segments[0].video_id if segments else None,
            'video_title': segments[0].video_title if segments else None,
            'segments_ingested': len(segments),
            'total_duration': segments[-1].end_time if segments else 0,
            'url': url
        }
        
        logger.info(f"Ingestion completed successfully: {result['segments_ingested']} segments ingested")
        logger.info(f"Video: {result['video_title']} (ID: {result['video_id']})")
        logger.info(f"Total duration: {result['total_duration']:.1f} seconds")
        
        return result




# Example usage function
async def ingest_youtube_video_example(url: str):
    """Example of how to ingest a YouTube video."""
    logger.info("Starting YouTube video ingestion example")
    # Create vector database
    from aimakerspace.vectordatabase import VectorDatabase
    logger.info("Creating VectorDatabase instance...")
    vector_db = VectorDatabase()
    
    # Create YouTube processor
    processor = YouTubeProcessor()
    
    # Ingest video
    logger.info("Starting video ingestion...")
    result = await processor.ingest_youtube_video(vector_db, url)
    logger.info(f"Ingested {result['segments_ingested']} segments from: {result['video_title']}")
    print(f"Ingested {result['segments_ingested']} segments from: {result['video_title']}")
    
    # Example search
    search_results = vector_db.search_with_metadata("machine learning", k=3)
    
    for result in search_results:
        print(f"\nFound at {result['start_time']:.1f}s - {result['end_time']:.1f}s:")
        print(f"Text: {result['text'][:100]}...")
        print(f"Video: {result['video_title']}")
        print(f"Similarity: {result['similarity_score']:.3f}")
    
    return vector_db


if __name__ == "__main__":
    # Example usage
    url = "https://www.youtube.com/watch?v=ZTOtxiWb2bE"
    db = asyncio.run(ingest_youtube_video_example(url))
    print("YouTube ingestion module ready!")
    k = 2
    searched_vector = db.search_with_metadata("What is Content aware chuncking?", k=k)
    print(f"Closest {k} vector(s):", searched_vector)
