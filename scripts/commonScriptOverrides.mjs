// Sub/superscripts the 900080A18 / 900090A14 text layer flattens ("CO2", "PM2.5",
// "Lux/m 2"). The PDFs draw them as smaller glyphs on a shifted baseline
// (pdftotext -bbox; 18 tokens, all covered here). Shared subjects must read the
// same in every pack, so both build paths use this one list:
// build-exam-packs.mjs and the legacy import-questions.mjs (web-design-b).
// Text is the built text with only the script glyphs changed; 90009-04-006
// keeps the official stem tail after ④.
export const COMMON_SCRIPT_PROMPTS = {
  '90008-03-028': '下列何種生活小習慣的改變可減少細懸浮微粒（PM₂.₅）排放，共同為改善空氣品質盡一份心力？',
  '90008-03-072': '有關空氣中細懸浮微粒（PM₂.₅）之敘述，下列何者正確？ A.空氣品質測站中自動監測儀所測得之數值若高於空氣品質標準，即判定為不符合空氣品質標準；B.濃度監測之標準方法為中央主管機關公告之手動檢測方法；C.空氣品質標準之年平均值為 12μg/m³？',
  '90008-03-077': '細懸浮微粒（PM₂.₅）除了來自於污染源直接排放外，亦可能經由下列哪一種反應產生？',
}

export const COMMON_SCRIPT_OPTIONS = {
  '90008-03-039': ['懸浮微粒', '二氧化碳(CO₂)', '臭氧(O₃)', '沼氣'],
  '90009-04-006': ['氧化亞氮（N₂O）', '二氧化碳（CO₂）', '甲烷（CH₄）', '六氟化硫（SF₆） 當量表示'],
  '90009-04-050': ['CO₂', 'CH₄', 'SF₆', 'N₂O'],
  '90009-04-098': ['二氧化碳（CO₂）', '氫氟碳化物（HFCs）', '甲烷（CH₄）', '氧氣（O₂）'],
  '90009-04-099': ['汽車－公里/公升', '照明系統－勒克司/平方公尺（Lux/m²）', '冰水主機－千瓦/冷凍噸（kW/RT）', '冰水主機－千瓦 （kW）'],
}
