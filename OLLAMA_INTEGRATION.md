# Ollama Integration Guide

This document describes the Ollama integration added to the AI Engineering Challenge project, enabling local LLM inference without requiring API keys.

## Overview

Ollama support has been added as a third LLM provider alongside OpenAI and Together.ai. This integration allows users to:

- Run models locally without API keys
- Dynamically fetch available models from an Ollama server
- Use local embeddings for RAG functionality
- Maintain full privacy with local inference

## Features

### ✅ Supported Features

- **Chat Interface**: Full chat functionality with local Ollama models
- **Model Selection**: Dynamic fetching and selection of available Ollama models
- **RAG Support**: Document upload and querying with local embeddings
- **Streaming Responses**: Real-time streaming of model responses
- **Multiple Model Types**: Support for various Ollama model families (Llama, Mistral, CodeLlama, etc.)

### 🔧 Backend Changes

1. **New Dependencies**
   - Added `ollama>=0.4.4` to requirements
   - Updated `pyproject.toml` and `api/requirements.txt`

2. **Enhanced ChatOpenAI Class**
   - Added Ollama provider support with base URL configuration
   - Implemented Ollama-specific chat completion handling
   - Added async support for Ollama client

3. **Enhanced EmbeddingModel Class**
   - Added Ollama embedding support with configurable models
   - Default embedding model: `nomic-embed-text:latest`
   - Fallback to sync operations for Ollama

4. **Updated RAG System**
   - Enhanced RAGSystem to support Ollama with base URL and embedding model parameters
   - Updated `get_or_create_rag_system` function for Ollama compatibility

5. **New API Endpoints**
   - `/api/ollama-models`: Fetch available models from Ollama server
   - Enhanced existing endpoints with Ollama parameter support

6. **Provider Validation**
   - Updated all provider validation to include "ollama"
   - Dynamic model validation for Ollama models

### 🎨 Frontend Changes

1. **Provider Selection**
   - Added "Ollama (Local)" option to provider dropdown
   - Updated provider information display

2. **Server URL Input**
   - Added Ollama server URL input field (replaces API key input for Ollama)
   - Default URL: `http://localhost:11434`
   - "Fetch Models" button to dynamically load available models

3. **Model Management**
   - Dynamic model fetching from Ollama server
   - Automatic model selection when switching to Ollama
   - Loading states for model fetching

4. **Enhanced UI**
   - Context-aware labels (Server URL vs API Key)
   - Ollama-specific help text and information
   - Updated warning messages for Ollama

## Setup Instructions

### Prerequisites

1. **Install Ollama**
   ```bash
   # On macOS
   brew install ollama
   
   # On Linux
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # On Windows
   # Download from https://ollama.ai/download
   ```

2. **Start Ollama Server**
   ```bash
   ollama serve
   ```

3. **Pull Models**
   ```bash
   # Example models
   ollama pull llama3.2:latest
   ollama pull mistral:latest
   ollama pull nomic-embed-text:latest  # For embeddings
   ```

### Using Ollama in the Application

1. **Select Provider**
   - Open the application
   - In the settings panel, select "Ollama (Local)" as the provider

2. **Configure Server URL**
   - Enter your Ollama server URL (default: `http://localhost:11434`)
   - Click "Fetch Models" to load available models

3. **Select Model**
   - Choose from the dynamically loaded models
   - Models are automatically filtered based on availability

4. **Start Chatting**
   - No API key required!
   - Full chat functionality with local inference

### RAG with Ollama

1. **Upload Documents**
   - Upload PDF, Word, or PowerPoint documents
   - Documents are processed with local embeddings (`nomic-embed-text:latest`)

2. **Switch to RAG Mode**
   - Select "RAG" or "Topic Explorer" mode
   - Ask questions about your uploaded documents

3. **Local Processing**
   - All embedding and inference happens locally
   - Complete privacy and no external API calls

## Configuration

### Default Settings

- **Default Server URL**: `http://localhost:11434`
- **Default Chat Model**: `llama3.2:latest`
- **Default Embedding Model**: `nomic-embed-text:latest`

### Customization

You can customize the default models by modifying:

- **Frontend**: Update default models in `ChatInterface.tsx`
- **Backend**: Update default models in the provider-specific code

## Troubleshooting

### Common Issues

1. **"Failed to fetch Ollama models"**
   - Ensure Ollama server is running: `ollama serve`
   - Check server URL is correct
   - Verify network connectivity

2. **"Model not found"**
   - Pull the required model: `ollama pull <model-name>`
   - Refresh the model list with "Fetch Models"

3. **Embedding errors in RAG mode**
   - Ensure embedding model is available: `ollama pull nomic-embed-text:latest`
   - Check Ollama server logs for errors

### Performance Tips

1. **Model Selection**
   - Smaller models (7B parameters) for faster responses
   - Larger models (70B+ parameters) for better quality

2. **Hardware Requirements**
   - Minimum 8GB RAM for 7B models
   - 32GB+ RAM recommended for larger models
   - GPU acceleration supported with CUDA/Metal

## API Reference

### New Endpoints

#### POST /api/ollama-models
Fetch available models from Ollama server.

**Request Body:**
```json
{
  "base_url": "http://localhost:11434"
}
```

**Response:**
```json
{
  "models": [
    {
      "name": "llama3.2:latest",
      "size": 4661224676,
      "digest": "abc123...",
      "modified_at": "2024-01-01T00:00:00Z"
    }
  ],
  "message": "Models fetched successfully"
}
```

### Enhanced Headers

For Ollama requests, the following headers are used:

- `X-Provider`: "ollama"
- `X-Base-URL`: Ollama server URL
- `X-Embedding-Model`: Embedding model name (for RAG)

## Security Considerations

### Advantages

- **Complete Privacy**: All processing happens locally
- **No API Keys**: No sensitive credentials to manage
- **Offline Capability**: Works without internet connection

### Considerations

- **Local Resources**: Requires sufficient local compute resources
- **Model Management**: Users responsible for model updates and security
- **Network Security**: Ensure Ollama server is properly secured if exposed

## Future Enhancements

Potential improvements for the Ollama integration:

1. **Model Management UI**: Interface for pulling/removing models
2. **Performance Monitoring**: Display inference speed and resource usage
3. **Custom Model Support**: Support for fine-tuned and custom models
4. **Advanced Configuration**: Temperature, top-p, and other parameter controls
5. **Multi-Modal Support**: Image and document understanding capabilities

## Contributing

When contributing to the Ollama integration:

1. Test with multiple model types and sizes
2. Ensure backward compatibility with OpenAI/Together.ai
3. Update documentation for any new features
4. Consider resource usage and performance implications

## Support

For issues specific to Ollama integration:

1. Check Ollama server logs: `ollama logs`
2. Verify model availability: `ollama list`
3. Test with minimal models first
4. Report issues with system specifications and model details
