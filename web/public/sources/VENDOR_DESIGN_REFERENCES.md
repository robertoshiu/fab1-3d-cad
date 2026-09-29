# FAB-1 原廠設備與管線參考

查閱日期：2026-09-29。下表區分原廠證據與本案推導，用於補足設備比例、材料及接點细節。原廠公開資料不等同本案已完成設備選型或性能驗證。

## 原廠來源（8 項）

| ID | 原廠文件／頁次 | 可核對的原廠值 | 本案用途及限制 |
|---|---|---|---|
| R01 | [Nicotra Gebhardt — FFU Issue 7.1 EN](https://www.nicotra-gebhardt.se/wp-content/uploads/2024/06/Katalog_RHP_ENG.pdf)，p.4、12、22 | RHP1212 MultiEvo 名義格網1200×1200，含濾網外形1172×1172×420 mm；RHP0612-331 名義600×1200，外形572×1172×445 mm。型錄0.35／0.45 m/s欄：方形1814／2333 m3/h；長形907／1166 m3/h。U15選項99.9995%。 | FFU本體須小於格網；上方風機、下方濾網、鋁框及T型支承分開表現。U15、風速、覆蓋率為本案暫定選擇，不構成ISO潔淨度驗證。 |
| R02 | [EBARA — Ultraclean Equipment Series](https://www.ebara.com/content/dam/ebara/grand-masters/entities/en/products/precision-pump/pdf/80002E_26_4.pdf)，印刷p.2–5、12（PDF第3、4、8頁） | W×D×H：EV-S100為260×510×520 mm；EV-S200為275×650×580；EV-M502N為485×975×870。TND-Single／Plus除害櫃1200×650×1980 mm。EV-S屬輕至中负載，EV-M屬高负載系列。 | B1低矮泵體與約2 m高除害櫃分開。安裝區可較大，不能把整個包絡當泵殼。型號為外形參考，非本案已選定设备。 |
| R03 | [EBARA — EV-S specifications](https://www.ebara.com/global-en/products/EVS/) | EV-S100入口NW80、出口NW25；冷卻水2–3 L/min、最高30°C；抽速10000 L/min。原廠說明規格隨型號不同。 | 泵端需有較大前級真空入口、較小排氣出口及一對冷卻水管。抽速不直接當作全廠排氣量。 |
| R04 | [Daikin — Professional AHU](https://www.daikin.eu/en_us/product-group/air-handling-units/professional.html)，Product features | 客製系列最高144000 m3/h；有DDC控制櫃、溫濕度感測、混風風門、濾網／風機壓差開關及冷／熱水盤管控制。 | RF畫出箱體分段、檢修面、盤管供回水口、濾網／風機／風門、控制櫃。現有10000×4000 mm包絡及60000 m3/h是本案假設，並非此頁的已選型機組。 |
| R05 | [GF — SYGEF Plus PVDF-HP System Specification, April 2023](https://www.gfps.com/content/dam/gfps/com/specifications/en/gfps-system-specification-sygef-plus-en.pdf)，p.3、7–9 | 外徑／最小壁厚：d63／3.0、d110／5.3、d160／7.7 mm；提供IR／BCF熔接與隔膜閥。SYGEF Plus系列不提供球閥。 | UPW以PVDF-HP幹管、熔接彎頭／三通及隔膜閥表現。區分外徑d與公稱DN；本案選用哪些管徑仍待流量壓損計算。 |
| R06 | [Entegris — FluoroLine Ultrapure PFA Tubing](https://www.entegris.com/content/dam/product-assets/fluorolineultrapurepfatubing/datasheet-fluorolineultrapurepfatubing.pdf)，p.1–3 | 用於高純度化學液、微影、CMP、WEC。1/2 inch外徑12.70 mm、可選壁厚1.57 mm；3/4 inch外徑19.05、壁厚1.57。1/2 inch內徑9.55的組合最小彎曲半徑58 mm。 | 化學液hook-up用細徑PFA與平順轉彎，別全部畫成大型金屬法蘭管。彎曲半徑只適用對應管材規格。 |
| R07 | [Swagelok — UHP Valves for Atomic Layer Processing, MS-02-301 rev.V](https://www.swagelok.com/downloads/webcatalogs/en/ms-02-301.pdf)，p.1、3–5 | UHP閥提供316L VIM-VAR材質及VCR／對焊／表面安裝端接。ALD3／6圖示为金屬閥體、上置氣動致動器、側向進出口。 | 氣體盤以小型隔膜閥、面密封接頭、細管表現。此資料支持閥材與形態，不證明整套N2或PCW材料相容性。 |
| R08 | [Daifuku — Semiconductor Production Line Systems](https://www.daifuku.com/daifuku-square/article/000999/)，Cleanway／Stocker／STB段落 | 天花軌道搬送FOUP，可結合氮氣置換stocker；STB為軌道間的懸吊暫存平台。 | OHT有軌道、車體、升降機構、FOUP、load port及局部STB。車體尺寸、軌高、彎道半徑均屬本案假設，本文沒有這些數值。 |

均為製造商或其地區官方網站，已讀取頁面或PDF文字。R01使用瑞典原廠站英文本，避開改版主站舊連結的重新導向。

## 套用現有參數

- 建築250000×90000 mm、樓層標高、7.5／15 m軸網、Bay／Chase、MAU及立管位置維持 `fab1cad/params.py`；網路資料補足設備層級。
- 分開表示設備本體、安裝包絡及檢修區；小型元件在1:400總圖用符號，在放大詳圖畫實際尺度。3D機殼可依原廠比例放在既有設備包絡內。
- 本案建議材質：UPW採PVDF-HP幹線／PFA接管；PCW暫採316L，N2暫採潔淨不鏽鋼及適用UHP接頭。這些是設計選擇，R07不是PCW管材認證。
- 幾何推導細節：閥體／手輪／氣動頭、泵底座、接管、壓力表、管架梁柱、支吊架、保溫、法蘭、門縫／把手、流向及系統標籤。未取得原廠尺寸者採示意外形，不標為精確產品模型。

## 設計假設界線

FFU數量／覆蓋率、MAU／DCC冷量、幹支管徑、泵組數量／分配、除害負載、配電容量、OHT軌高／速度、管架標高／承載、保溫厚度、支吊架間距、檢修淨空及閥件壓力等級仍需設備表及計算確認。來源未提供FAB-1實際機台utility matrix，亦不證明本模型完成氣流、壓損、耐震、排放或碰撞驗證。

建議圖面註記：**SD基本設計／設備外形參照原廠公開資料；未提供的尺寸、管徑及容量為設計假設。**
