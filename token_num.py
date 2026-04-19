import tiktoken
enc = tiktoken.get_encoding("cl100k_base")
with open("agent-canvas-code.txt", "r") as f:
    text = f.read()
print(len(enc.encode(text)))

# Usage:  python3.11 ./token_num.py
