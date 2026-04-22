import re

# ------------- planos.html -------------
with open('views/planos.html', 'r', encoding='utf-8') as f:
    planos = f.read()

for tab in ['metas', 'okrs', 'macro', 'micro']:
    # Match <section id="tab-metas">...</section>
    pattern = r'(<section [^>]*?id="tab-' + tab + r'"[^>]*>).*?(</section>)'
    replacement = r'\1\n<div id="' + tab + r'-container" class="space-y-12"></div>\n\2'
    planos = re.sub(pattern, replacement, planos, flags=re.DOTALL)

with open('views/planos.html', 'w', encoding='utf-8') as f:
    f.write(planos)

# ------------- proposito.html -------------
with open('views/proposito.html', 'r', encoding='utf-8') as f:
    prop = f.read()

prop = prop.replace('<polygon class="text-primary/20', '<polygon id="roda-polygon" class="text-primary/20')

# We want to change the structure:
# <div class="flex-1 flex items-center justify-center py-4">
#   <div class="relative w-72 h-72 flex items-center justify-center">
#     ...
#   </div>
# </div>
# To include the sliders alongside the wheel.
old_container = '<div class="flex-1 flex items-center justify-center py-4">'
new_container = '<div class="flex-1 flex flex-col md:flex-row items-center justify-center py-4 gap-12">'
prop = prop.replace(old_container, new_container)

# Add the sliders div right after the end of the relative w-72 h-72 div
# The relative w-72 h-72 div ends strictly with:
# <span class="absolute top-[12%] left-[10%] text-[9px] font-label uppercase tracking-widest text-outline">Propósito</span>
# </div>
end_of_wheel = r'(<span class="absolute top-\[12%\] left-\[10%\].*?Propósito</span>\s*</div>)'
sliders_div = r'\n<div id="roda-sliders" class="w-full max-w-[200px] flex flex-col gap-3"></div>\n'
prop = re.sub(end_of_wheel, r'\1' + sliders_div, prop)

with open('views/proposito.html', 'w', encoding='utf-8') as f:
    f.write(prop)

print("Done")
