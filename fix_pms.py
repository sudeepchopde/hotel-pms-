import re
import os

file_path = r'c:\Users\PC\Documents\pms\components\GuestProfilePage.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to find words separated by " - " in className or backticks that look like Tailwind or CSS classes
# We want to match things like "items - center", "p - 2.5", "bg - red - 50"
# But we must avoid things like "₹ ${amount}" or "Total - 10" which are actual math or display strings.
# Tailwind classes usually appear inside quotes or bracketed backticks.

# This regex matches patterns like " [a-z]+ - [a-z0-9]+ " or " [a-z]+ - [0-9.]+ " 
# specifically when they look like part of a class name list.
# We'll use a conservative approach: only replace if the prefix is a known tailwind category or if it's within a className string.

def fix_tailwind_spaces(match):
    s = match.group(0)
    # Remove " - " but maintain the rest
    return s.replace(' - ', '-')

# Fix common tailwind prefixes followed by space-dash-space
# e.g. flex-1, bg-white, p-4, items-center, justify-between, gap-4, rounded-xl, text-sm, font-black, tracking-tight, shadow-sm, transition-all, duration-300, animate-in, fade-in, slide-in-from-bottom-4, border-b, px-8, py-4, z-10000, h-6, w-6
tailwind_prefixes = [
    'flex', 'items', 'justify', 'gap', 'p', 'px', 'py', 'pt', 'pb', 'pl', 'pr',
    'm', 'mx', 'my', 'mt', 'mb', 'ml', 'mr', 'w', 'h', 'bg', 'text', 'font',
    'rounded', 'border', 'shadow', 'tracking', 'z', 'animate', 'duration',
    'delay', 'opacity', 'scale', 'rotate', 'translate', 'skew', 'origin',
    'cursor', 'pointer', 'grid', 'col', 'row', 'span', 'divide', 'space',
    'ring', 'outline', 'select', 'overflow', 'custom', 'tabular', 'blur',
    'transition', 'active', 'hover', 'focus', 'group', 'peer', 'inset',
    'top', 'bottom', 'left', 'right', 'max', 'min', 'object', 'from', 'to', 'via',
    'fade', 'slide', 'zoom', 'ring', 'fill', 'stroke'
]

# regex to find prefix - something
# We search for the prefix followed by " - " and then some word characters or numbers or brackets
pattern = r'\b(' + '|'.join(tailwind_prefixes) + r')\s+-\s+([a-zA-Z0-9.\[\]]+)'

content = re.sub(pattern, r'\1-\2', content)

# Also fix the specific corruption in HTML tags if any remain
content = content.replace('< / html >', '</html>')
content = content.replace('< / body >', '</body>')
content = content.replace('< / div >', '</div>')
content = content.replace('< / section >', '</section>')
content = content.replace('< / header >', '</header>')
content = content.replace('< / button >', '</button>')
content = content.replace('< / table >', '</table>')
content = content.replace('< / thead >', '</thead>')
content = content.replace('< / tbody >', '</tbody>')
content = content.replace('< / tr >', '</tr>')
content = content.replace('< / td >', '</td>')
content = content.replace('< / th >', '</th>')
content = content.replace('< / span >', '</span>')
content = content.replace('< / h1 >', '</h1>')
content = content.replace('< / h2 >', '</h2>')
content = content.replace('< / h3 >', '</h3>')
content = content.replace('< / h4 >', '</h4>')
content = content.replace('< / p >', '</p>')
content = content.replace('< / script >', '</script>')
content = content.replace('< / head >', '</head>')
content = content.replace('< / html >', '</html>')

# Fix corrupted backticks closing with space before
content = re.sub(r'(\w+)\s+`', r'\1`', content)
content = content.replace(' } `', '}`')
content = content.replace(' }`', '}`')

# Fix specifically identified corrupted lines
content = content.replace('< / div >', '</div>')
content = content.replace('</ div >', '</div>')
content = content.replace('< /div >', '</div>')

# Fix corrupted class names in interpolation
# e.g. items - center gap - 2
content = re.sub(r'items\s+-\s+center', 'items-center', content)
content = re.sub(r'gap\s+-\s+([0-9.]+)', r'gap-\1', content)
content = re.sub(r'px\s+-\s+([0-9.]+)', r'px-\1', content)
content = re.sub(r'py\s+-\s+([0-9.]+)', r'py-\1', content)
content = re.sub(r'rounded\s+-\s+([a-z0-9-]+)', r'rounded-\1', content)
content = re.sub(r'text\s+-\s+([a-z0-9-\[\]]+)', r'text-\1', content)
content = re.sub(r'font\s+-\s+([a-z0-9-]+)', r'font- \1', content) # space-font? No, font-black
content = re.sub(r'font- \s+([a-z-]+)', r'font-\1', content)
content = re.sub(r'tracking\s+-\s+([a-z-]+)', r'tracking-\1', content)
content = re.sub(r'shadow\s+-\s+([a-z-]+)', r'shadow-\1', content)
content = re.sub(r'transition\s+-\s+([a-z-]+)', r'transition-\1', content)

# Check for " - " in specific classNames that were observed
content = re.sub(r'w\s+-\s+([0-9.]+)', r'w-\1', content)
content = re.sub(r'h\s+-\s+([0-9.]+)', r'h-\1', content)
content = re.sub(r'bg\s+-\s+([a-z0-9-\/]+)', r'bg-\1', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fix completed.")
