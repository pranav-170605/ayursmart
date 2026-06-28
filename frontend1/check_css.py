import sys

def check_braces(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    lines = content.split('\n')
    
    for i, line in enumerate(lines):
        for j, char in enumerate(line):
            if char == '{':
                stack.append((i+1, j+1))
            elif char == '}':
                if not stack:
                    print(f"Error: Unexpected '}}' at line {i+1}, char {j+1}")
                    return
                stack.pop()
                
    if stack:
        print(f"Error: Unclosed '{{' found at:")
        for line, col in stack:
            print(f"  Line {line}, char {col}")
    else:
        print("Success: All braces match perfectly.")

check_braces(r'd:\ayursmart final\frontend1\style.css')
