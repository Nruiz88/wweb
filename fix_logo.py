with open('src/app/privacidad/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('<LogoMark />', '<span class="font-bold text-[#25d366]">Boti</span>')
with open('src/app/privacidad/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('fixed privacidad')

with open('src/app/terminos/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('<LogoMark />', '<span class="font-bold text-[#25d366]">Boti</span>')
with open('src/app/terminos/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('fixed terminos')
