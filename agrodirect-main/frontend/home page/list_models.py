import google.generativeai as genai
import os

genai.configure(api_key="AIzaSyBhQKWiqxpzbsBFrzuWvzBOcm-lWFgD7Kg")

try:
    print("Listing available models...")
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"Model ID: {m.name}")
except Exception as e:
    print(f"Error: {e}")
