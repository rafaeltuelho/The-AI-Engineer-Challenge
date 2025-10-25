#!/usr/bin/env python3
"""
Test script to verify Ollama integration works correctly.
This script tests the basic functionality without requiring a full Ollama server.
"""

import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'api'))

def test_imports():
    """Test that all required imports work correctly."""
    print("Testing imports...")
    
    try:
        import ollama
        print("✓ ollama import successful")
    except ImportError as e:
        print(f"✗ ollama import failed: {e}")
        return False
    
    try:
        from aimakerspace.openai_utils.chatmodel import ChatOpenAI
        print("✓ ChatOpenAI import successful")
    except ImportError as e:
        print(f"✗ ChatOpenAI import failed: {e}")
        return False
    
    try:
        from aimakerspace.openai_utils.embedding import EmbeddingModel
        print("✓ EmbeddingModel import successful")
    except ImportError as e:
        print(f"✗ EmbeddingModel import failed: {e}")
        return False
    
    return True

def test_chatmodel_initialization():
    """Test ChatOpenAI initialization with Ollama provider."""
    print("\nTesting ChatOpenAI initialization...")
    
    try:
        from aimakerspace.openai_utils.chatmodel import ChatOpenAI
        
        # Test Ollama initialization
        chat_model = ChatOpenAI(
            api_key="dummy", 
            provider="ollama", 
            base_url="http://localhost:11434"
        )
        print("✓ ChatOpenAI Ollama initialization successful")
        
        # Test that provider is set correctly
        assert chat_model.provider == "ollama"
        assert chat_model.base_url == "http://localhost:11434"
        print("✓ ChatOpenAI Ollama configuration correct")
        
        return True
    except Exception as e:
        print(f"✗ ChatOpenAI Ollama initialization failed: {e}")
        return False

def test_embedding_initialization():
    """Test EmbeddingModel initialization with Ollama provider."""
    print("\nTesting EmbeddingModel initialization...")
    
    try:
        from aimakerspace.openai_utils.embedding import EmbeddingModel
        
        # Test Ollama initialization
        embedding_model = EmbeddingModel(
            api_key="dummy",
            provider="ollama",
            base_url="http://localhost:11434",
            embedding_model="nomic-embed-text:latest"
        )
        print("✓ EmbeddingModel Ollama initialization successful")
        
        # Test that provider is set correctly
        assert embedding_model.provider == "ollama"
        assert embedding_model.base_url == "http://localhost:11434"
        assert embedding_model.embeddings_model_name == "nomic-embed-text:latest"
        print("✓ EmbeddingModel Ollama configuration correct")
        
        return True
    except Exception as e:
        print(f"✗ EmbeddingModel Ollama initialization failed: {e}")
        return False

def test_rag_system_initialization():
    """Test RAGSystem initialization with Ollama provider."""
    print("\nTesting RAGSystem initialization...")
    
    try:
        from api.rag_lightweight import RAGSystem
        
        # Test Ollama initialization
        rag_system = RAGSystem(
            api_key="dummy",
            provider="ollama",
            base_url="http://localhost:11434",
            embedding_model="nomic-embed-text:latest"
        )
        print("✓ RAGSystem Ollama initialization successful")
        
        # Test that provider is set correctly
        assert rag_system.provider == "ollama"
        assert rag_system.base_url == "http://localhost:11434"
        print("✓ RAGSystem Ollama configuration correct")
        
        return True
    except Exception as e:
        print(f"✗ RAGSystem Ollama initialization failed: {e}")
        return False

def main():
    """Run all tests."""
    print("🧪 Testing Ollama Integration")
    print("=" * 50)
    
    tests = [
        test_imports,
        test_chatmodel_initialization,
        test_embedding_initialization,
        test_rag_system_initialization
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        print()
    
    print("=" * 50)
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Ollama integration is ready.")
        return 0
    else:
        print("❌ Some tests failed. Please check the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
