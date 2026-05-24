import google.generativeai as genai
import sys

genai.configure(api_key="AIzaSyBhQKWiqxpzbsBFrzuWvzBOcm-lWFgD7Kg")

print(f"Python version: {sys.version}")
try:
    import google.generativeai as gai
    print(f"SDK Version: {gai.__version__}")
except:
    print("Could not determine SDK version")

try:
    print("Available Models:")
    models = genai.list_models()
    for m in models:
        print(f"- {m.name} (Supports: {m.supported_generation_methods})")
except Exception as e:
    print(f"Error listing models: {e}")
