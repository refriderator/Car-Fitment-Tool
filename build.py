"""Assemble the page from src/ and fonts/.
   index.html    - full document, for GitHub Pages or any static host (serve it next to cars/)
   artifact.html - the same page without the document skeleton, for publishing as a Claude artifact"""
import base64, os
here = os.path.dirname(os.path.abspath(__file__))
def face(fam, file, w):
    b = base64.b64encode(open(os.path.join(here, 'fonts', file), 'rb').read()).decode()
    return '@font-face{font-family:"%s";src:url(data:font/woff2;base64,%s) format("woff2");font-weight:%d;font-style:normal;font-display:swap}' % (fam, b, w)
fonts = '\n'.join([face('Michroma', 'Michroma-Regular.woff2', 400), face('Chakra Petch', 'ChakraPetch-Regular.woff2', 400),
                   face('Chakra Petch', 'ChakraPetch-Medium.woff2', 500), face('VT323', 'VT323-Regular.woff2', 400), face('STXingkai', 'STXingkai-Latin.woff2', 400)])
src = lambda n: open(os.path.join(here, 'src', n)).read()
body = src('page.html').replace('/*FONTS*/', fonts).replace('/*CORE*/', src('core.js')).replace('/*APP*/', src('app.js'))
open(os.path.join(here, 'artifact.html'), 'w').write(body)
open(os.path.join(here, 'index.html'), 'w').write('<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    '<style>body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style></head><body>\n' + body + '\n</body></html>\n')
print('built', len(body), 'bytes')
