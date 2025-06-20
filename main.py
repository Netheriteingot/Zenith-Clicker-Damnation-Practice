import re
import os
import random
from collections import defaultdict

def read_mods_from_file(filename='mods.lua'):
    try:
        with open(filename, 'r') as file:
            content = file.read()
    except FileNotFoundError:
        return f"Error: File '{filename}' not found."
    
    pattern = r'{\s*set\s*=\s*"(.*?)",\s*name\s*=\s*"(.*?)"\s*}'
    matches = re.findall(pattern, content)
    
    if not matches:
        return "Error: No valid entries found in the file."
    
    return matches

def get_random_mod_combination(k, filename='mods.lua'):
    
    matches = read_mods_from_file(filename)
    
    if k == 0: return random.choice(matches)
    
    valid_entries = []
    for set_str, name in matches:
        mod_count = len(set_str.split())
        if mod_count == k:
            valid_entries.append([set_str, name])
    
    if not valid_entries:
        return f"No combinations found with exactly {k} mods."
    
    return random.choice(valid_entries)

def compare_mod_strings(key: str, input_str: str) -> bool:
    def are_mods_equal(mods1: str, mods2: str) -> bool:
        return set(mods1.split()) == set(mods2.split())
    if (are_mods_equal(key, input_str)): return True
    mod_to_letter = {
        'EX': 'q',
        'NH': 'w',
        'MS': 'e',
        'GV': 'r',
        'VL': 't',
        'DH': 'y',
        'IN': 'u',
        'AS': 'i',
        'DP': 'o'
    }
    mods = key.split()
    converted_chars = []
    for mod in mods:
        if mod in mod_to_letter:
            converted_chars.append(mod_to_letter[mod])
        else:
            converted_chars.append('?')
    converted_key = ''.join(converted_chars)
    processed_input = input_str.replace(' ', '').lower()
    if len(converted_key) != len(processed_input):
        return False
    
    key_counts = defaultdict(int)
    input_counts = defaultdict(int)
    
    for c in converted_key:
        key_counts[c] += 1
    
    for c in processed_input:
        input_counts[c] += 1
    
    return key_counts == input_counts

print("Please input the number of mods: (0 for random)")
k = int(input())
print("-------------------")
while(True):
    # os.system('cls')
    a = get_random_mod_combination(k)
    print(a[1])
    print("Please input the mod string:")
    b = input()
    if(compare_mod_strings(a[0], b)):
        print("Correct!")
    else:
        print(f"NO! The answer is: {a[0]}")
    print("-------------------")