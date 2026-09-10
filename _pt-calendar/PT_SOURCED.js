/* PT_SOURCED — Portuguese seasonality taken from PUBLISHED NATIONAL SOURCES,
   not derived from our own prose labels.

   The TARGETS comment above says everything outside the lore set can only be
   checked against the label it came from, which is circular. That was true
   until these three calendars were captured on 2026-09-01. They are written
   for a different reason, by Portuguese bodies, and they break the circle for
   the mediterranean band.

   Precedence, applied in derive(): a hand OVERRIDE beats this table, because
   an override encodes a dated folk claim (St David's leeks, Old Michaelmas
   blackberries) that a production calendar cannot know. This table beats the
   label derivation. Temperate ranges are NOT touched here — these sources
   speak only for Portugal.

   Sources:
     APN  Alianca contra a Fome/APN, Calendarios de Producao Nacional, 2021 (national production)
     DECO DECO PROteste, Fruta e legumes da epoca, updated 2024-09-24
     CNT  Continente feed, Fruta e legumes da epoca, updated 2024-01-25 (retail; imports stripped by hand)

   Full transcription with per-item attribution: _pt-calendar/pt-sources.json */

const PT_SOURCED = {
  'acorn-squash': { from: '09-01', to: '02-28', src: 'APN', pt: 'Abóbora-bolota', key: 'abobora' },
  'apple': { from: '08-01', to: '05-31', src: 'APN', pt: 'Maçã', key: 'maca' },
  'apricot': { from: '05-01', to: '07-31', src: 'APN', pt: 'Alperce', key: 'damasco/alperce' },
  'asparagus': { from: '02-01', to: '06-30', src: 'CNT', pt: 'Espargos', key: 'espargos' },
  'aubergine': { from: '06-01', to: '10-31', src: 'APN', pt: 'Beringela', key: 'beringela' },
  'avocado': { from: '01-01', to: '12-31', src: 'DECO', pt: 'Abacate', key: 'abacate' },
  'beefsteak-tomato': { from: '05-01', to: '09-30', src: 'APN', pt: 'Tomate coração-de-boi', key: 'tomate' },
  'beetroot': { from: '08-01', to: '04-30', src: 'APN', pt: 'Beterraba', key: 'beterraba' },
  'bell-pepper': { from: '06-01', to: '10-31', src: 'APN', pt: 'Pimento', key: 'pimento' },
  'blackberry': { from: '06-01', to: '08-31', src: 'DECO', pt: 'Amora', key: 'amora' },
  'blueberry': { from: '06-01', to: '08-31', src: 'APN', pt: 'Mirtilo', key: 'mirtilo' },
  'breakfast-radish': { from: '05-01', to: '06-30', src: 'CNT', pt: 'Rabanete comprido', key: 'rabanete' },
  'broad-beans-fava': { from: '03-01', to: '10-31', src: 'CNT', pt: 'Favas', key: 'favas' },
  'broccoli-calabrese': { from: '10-01', to: '05-31', src: 'APN', pt: 'Brócolos', key: 'brocolo' },
  'butternut-squash': { from: '09-01', to: '02-28', src: 'APN', pt: 'Abóbora-manteiga', key: 'abobora' },
  'cantaloupe-melon': { from: '06-01', to: '09-30', src: 'DECO', pt: 'Meloa', key: 'meloa' },
  'carrot': { from: '01-01', to: '12-31', src: 'APN', pt: 'Cenoura', key: 'cenoura' },
  'cauliflower': { from: '10-01', to: '05-31', src: 'APN', pt: 'Couve-flor', key: 'couve-flor' },
  'cavolo-nero': { from: '11-01', to: '04-30', src: 'CNT', pt: 'Couve-negra', key: 'couve' },
  'chard': { from: '01-01', to: '04-30', src: 'CNT', pt: 'Acelga', key: 'acelga' },
  'cherry': { from: '05-01', to: '06-30', src: 'APN', pt: 'Cereja', key: 'cereja' },
  'cherry-tomato': { from: '05-01', to: '09-30', src: 'APN', pt: 'Tomate-cereja', key: 'tomate' },
  'chilli-pepper': { from: '06-01', to: '10-31', src: 'APN', pt: 'Malagueta', key: 'pimento' },
  'conference-pear': { from: '08-01', to: '11-30', src: 'APN', pt: 'Pera conference', key: 'pera' },
  'cooking-apple': { from: '08-01', to: '05-31', src: 'APN', pt: 'Maçã para cozer', key: 'maca' },
  'courgette': { from: '06-01', to: '09-30', src: 'APN', pt: 'Courgette', key: 'curgete' },
  'crown-prince-squash': { from: '09-01', to: '02-28', src: 'APN', pt: 'Abóbora crown prince', key: 'abobora' },
  'cucumber': { from: '03-01', to: '10-31', src: 'CNT', pt: 'Pepino', key: 'pepino' },
  'damson': { from: '06-01', to: '09-30', src: 'DECO', pt: 'Abrunho', key: 'ameixa' },
  'fig': { from: '08-01', to: '09-30', src: 'APN', pt: 'Figo', key: 'figo' },
  'garden-peas': { from: '03-01', to: '06-30', src: 'APN', pt: 'Ervilhas', key: 'ervilha' },
  'garlic': { from: '06-01', to: '12-31', src: 'APN', pt: 'Alho', key: 'alho' },
  'globe-artichoke': { from: '07-01', to: '08-31', src: 'CNT', pt: 'Alcachofra', key: 'alcachofra' },
  'golden-beetroot': { from: '08-01', to: '04-30', src: 'APN', pt: 'Beterraba dourada', key: 'beterraba' },
  'grapes': { from: '08-01', to: '10-31', src: 'APN', pt: 'Uvas brancas', key: 'uva' },
  'grapes-black': { from: '08-01', to: '10-31', src: 'APN', pt: 'Uvas pretas', key: 'uva' },
  'green-cabbage': { from: '11-01', to: '04-30', src: 'CNT', pt: 'Repolho', key: 'couve' },
  'green-french-beans': { from: '06-01', to: '09-30', src: 'APN', pt: 'Feijão-verde', key: 'feijao-verde' },
  'greengage': { from: '06-01', to: '09-30', src: 'DECO', pt: 'Rainha-cláudia', key: 'ameixa' },
  'heritage-carrots': { from: '01-01', to: '12-31', src: 'APN', pt: 'Cenouras coloridas', key: 'cenoura' },
  'honeydew-melon': { from: '06-01', to: '08-31', src: 'APN', pt: 'Melão', key: 'melao' },
  'kabocha': { from: '09-01', to: '02-28', src: 'APN', pt: 'Abóbora kabocha', key: 'abobora' },
  'kale': { from: '11-01', to: '04-30', src: 'CNT', pt: 'Couve-frisada', key: 'couve' },
  'kiwi': { from: '10-01', to: '03-31', src: 'APN', pt: 'Kiwi', key: 'kiwi' },
  'leek': { from: '10-01', to: '04-30', src: 'APN', pt: 'Alho-francês', key: 'alho-frances' },
  'lemon': { from: '01-01', to: '12-31', src: 'APN', pt: 'Limão', key: 'limao' },
  'lettuce': { from: '01-01', to: '12-31', src: 'APN', pt: 'Alface', key: 'alface' },
  'little-gem': { from: '01-01', to: '12-31', src: 'APN', pt: 'Alface mini-romana', key: 'alface' },
  'mandarin-clementine': { from: '10-01', to: '02-28', src: 'APN', pt: 'Tangerina', key: 'tangerina' },
  'mangetout': { from: '03-01', to: '06-30', src: 'APN', pt: 'Ervilha-torta', key: 'ervilha' },
  'marrow': { from: '06-01', to: '09-30', src: 'APN', pt: 'Courgette grande', key: 'curgete' },
  'medlar': { from: '04-01', to: '06-30', src: 'DECO', pt: 'Nêspera-europeia', key: 'nespera' },
  'nectarine': { from: '06-01', to: '08-31', src: 'APN', pt: 'Nectarina', key: 'pessego' },
  'new-potato': { from: '05-01', to: '08-31', src: 'CNT', pt: 'Batata nova', key: 'batata-nova' },
  'onion': { from: '01-01', to: '12-31', src: 'APN', pt: 'Cebola', key: 'cebola' },
  'orange': { from: '11-01', to: '04-30', src: 'APN', pt: 'Laranja', key: 'laranja' },
  'padr-n-pepper': { from: '06-01', to: '10-31', src: 'APN', pt: 'Pimento de Padrón', key: 'pimento' },
  'peach': { from: '06-01', to: '08-31', src: 'APN', pt: 'Pêssego', key: 'pessego' },
  'pear': { from: '08-01', to: '11-30', src: 'APN', pt: 'Pera', key: 'pera' },
  'persimmon-kaki': { from: '10-01', to: '12-31', src: 'DECO', pt: 'Dióspiro', key: 'diospiro' },
  'plum': { from: '06-01', to: '09-30', src: 'DECO', pt: 'Ameixa', key: 'ameixa' },
  'plum-san-marzano-tomato': { from: '05-01', to: '09-30', src: 'APN', pt: 'Tomate-chucha', key: 'tomate' },
  'pointed-hispi-cabbage': { from: '11-01', to: '04-30', src: 'CNT', pt: 'Couve-coração', key: 'couve' },
  'pomegranate': { from: '09-01', to: '11-30', src: 'APN', pt: 'Romã', key: 'roma' },
  'potato': { from: '01-01', to: '12-31', src: 'APN', pt: 'Batata', key: 'batata' },
  'pumpkin': { from: '09-01', to: '02-28', src: 'APN', pt: 'Abóbora', key: 'abobora' },
  'purple-sprouting-broccoli': { from: '10-01', to: '05-31', src: 'APN', pt: 'Brócolos roxos', key: 'brocolo' },
  'quince': { from: '09-01', to: '10-31', src: 'CNT', pt: 'Marmelo', key: 'marmelo' },
  'radish': { from: '05-01', to: '06-30', src: 'CNT', pt: 'Rabanete', key: 'rabanete' },
  'raspberry': { from: '05-01', to: '07-31', src: 'APN', pt: 'Framboesa', key: 'framboesa' },
  'red-cabbage': { from: '11-01', to: '04-30', src: 'CNT', pt: 'Couve-roxa', key: 'couve' },
  'red-onion': { from: '01-01', to: '12-31', src: 'APN', pt: 'Cebola roxa', key: 'cebola' },
  'romaine-cos': { from: '01-01', to: '12-31', src: 'APN', pt: 'Alface-romana', key: 'alface' },
  'romanesco': { from: '10-01', to: '05-31', src: 'APN', pt: 'Couve romanesco', key: 'couve-flor' },
  'runner-beans': { from: '06-01', to: '09-30', src: 'APN', pt: 'Feijão-de-trepar', key: 'feijao-verde' },
  'savoy-cabbage': { from: '11-01', to: '04-30', src: 'CNT', pt: 'Couve-lombarda', key: 'couve' },
  'spaghetti-squash': { from: '09-01', to: '02-28', src: 'APN', pt: 'Abóbora-espaguete', key: 'abobora' },
  'spinach': { from: '10-01', to: '05-31', src: 'APN', pt: 'Espinafre', key: 'espinafre' },
  'spring-greens': { from: '11-01', to: '04-30', src: 'CNT', pt: 'Couve-galega', key: 'couve' },
  'strawberry': { from: '03-01', to: '06-30', src: 'APN', pt: 'Morango', key: 'morango' },
  'sugar-snap-peas': { from: '03-01', to: '06-30', src: 'APN', pt: 'Ervilha-doce', key: 'ervilha' },
  'sweetcorn': { from: '09-01', to: '10-31', src: 'CNT', pt: 'Milho-doce', key: 'milho' },
  'tenderstem-broccoli': { from: '10-01', to: '05-31', src: 'APN', pt: 'Brócolos-de-haste', key: 'brocolo' },
  'tomato': { from: '05-01', to: '09-30', src: 'APN', pt: 'Tomate', key: 'tomate' },
  'turnip': { from: '11-01', to: '04-30', src: 'CNT', pt: 'Nabo', key: 'nabo' },
  'watercress': { from: '03-01', to: '10-31', src: 'CNT', pt: 'Agrião', key: 'agriao' },
  'watermelon': { from: '06-01', to: '08-31', src: 'APN', pt: 'Melancia', key: 'melancia' },
};
