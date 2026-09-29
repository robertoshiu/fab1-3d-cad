# FAB-1 Blender 視覺數位孿生：材料與外形依據

查閱日期：2026-09-29。使用現有 FreeCAD 協調模型，補足材料、設備構造、環境及燈光。原廠尺寸是產品外形參考，不代表 FAB-1 已核定採購型號。Shader 數值及新增細節均為視覺設計假設。

## 幾何基準

`fab1cad/params.py`：主體 250 × 90 m；B1 −7.20 m、1F +14.80 m、2F +29.60 m、RF +41.80 m；高架地板面 +15.40 m；FFU 格網 1.20 m。保留 FreeCAD 物件 ID、樓層、系統名稱；CAD mm 至 Blender m 僅轉換一次。網路資料不改寫既有軸網和設備配置。

## 原始資料（10 項）

| ID | 原廠／原作者來源 | 確認事實及建模用途 |
|---|---|---|
| B01 | [Lindner ALUVENT](https://www.lindner-group.com/en/products/clean-room/clean-room-floor/aluvent) | 壓鑄鋁穿孔高架地板；格網 600×600 mm、板厚 52–60 mm、支座高 50–2000 mm；可有導電粉體塗裝。近景加孔洞、窄縫、邊框與支座。 |
| B02 | [Kingspan Architectural Wall Panel](https://www.kingspan.com/content/dam/kingspan/kip-west/wall-panels/awp-wall-panel/kingspan-architectural-wall-panel-data-sheet-en-nz.pdf) | 標準覆蓋寬度 1000 mm，非標準 900 mm；Micro-Rib、Mini-Micro、Plank、Wave；隱藏固定。外牆使用 1 m 分縫、低幅肋紋、門窗及角部收邊。顏色為本案假設。 |
| B03 | [Nicotra Gebhardt FFU Issue 7.1 EN](https://www.nicotra-gebhardt.se/wp-content/uploads/2024/06/Katalog_RHP_ENG.pdf)，p.12、22 | RHP0612-331 為 572×1172×445 mm；RHP1212 MultiEvo 為 1172×1172×420 mm（含濾網，不含附件）。鋁／鋼／不鏽鋼殼體、陽極鋁框、潔淨側 RAL 9010 護網。保留格網內安裝縫，風機入口、濾框及接線盒分件。 |
| B04 | [EBARA Ultraclean Equipment Series](https://www.ebara.com/content/dam/ebara/grand-masters/entities/en/products/precision-pump/pdf/80002E_26_4.pdf)，印刷 p.2–5、12 | W×D×H：EV-S100 260×510×520 mm；EV-S200 275×650×580；EV-M502N 485×975×870；TND 除害櫃 1200×650×1980。區分低矮泵體與高櫃，加入底座、真空口、排氣口、冷卻水双管、表頭及電纜。 |
| B05 | [Daifuku Semiconductor Production Line Systems](https://www.daifuku.com/daifuku-square/article/000999/) | Cleanway 天花軌道輸送 FOUP；Clean Stocker 暫存／氮氣置換；STB 軌道間暫存。軌道、車體、升降帶、FOUP、load port 分件。車體尺寸、燈號位置及琥珀色透明度是推導。 |
| B06 | [Poly Haven Industrial Sunset 02 (Pure Sky)](https://polyhaven.com/a/industrial_sunset_02_puresky) | Jarod Guest／Sergej Majboroda；1K–16K HDR/EXR；冷藍天空及低角暖日光。可用 4K HDR 作外景／屋頂反射光源，不假稱現場攝影。 |
| B07 | [Poly Haven Concrete Floor 02](https://polyhaven.com/a/concrete_floor_02) | 提供 diffuse、roughness、OpenGL normal、displacement。用於廠外基座或次設備層未塗裝面；潔淨室另用低紋理塗層或高架地板。 |
| B08 | [Poly Haven Asphalt 02](https://polyhaven.com/a/asphalt_02) | 提供 diffuse、roughness、OpenGL normal、displacement。只用廠外道路，配合標線、緣石及低頻色差，尺度依素材 info 核對。 |
| B09 | [Poly Haven License](https://polyhaven.com/license) | 素材採 CC0，可商用及再散布；範例渲染、網站文案及 logo 不包含在素材授權中。封裝原始材質 maps，保留來源及 hash。 |
| B10 | [ambientCG Metal010](https://ambientcg.com/view?id=Metal010) | 原頁 tags 為 brushed／silver／steel；2K JPG ZIP 約 17 MB；頁面確認素材 CC0。可降低 bump 後用於潔淨室拉絲金屬；不是實測 316L BRDF。 |

既有 `docs/VENDOR_DESIGN_REFERENCES.md` 另有 GF PVDF-HP、Entegris PFA、Swagelok UHP 閥與 Daikin AHU 依據；沿用其材料區分及接管形態，本輪不宣稱重新核定工程性能。

## 材料實作值（全部為視覺假設）

色票為 sRGB hex，shader 輸入須依色彩管理換成線性值。粗糙度是 Principled 起始值，最終以照明及近景驗證。

| 表面 | 色票 | Metallic | Roughness | 細節 |
|---|---|---:|---:|---|
| 設備粉體烤漆 | #DADDDC | 0 | 0.28–0.38 | 2–4 mm 門縫、2–5 mm 倒角、低對比微橘皮 |
| 陽極鋁 FFU／OHT 軌 | #B7BDC0 | 0.9–1 | 0.26–0.34 | 連接板、螺栓、長向拉絲 |
| 不鏽鋼主管／閥件 | #9EA9AC | 1 | 0.22–0.32 | 1–3 mm 倒角；接頭／薄焊道；roughness ±0.03，細紋高度 ≤0.1 mm |
| 保溫鋁皮外護層 | #B3B7BA | 1 | 0.34–0.42 | 500–1000 mm 環縫、縱向搭接及扣帶；外徑含保溫厚度 |
| 閉孔保溫套 | #252B2E | 0 | 0.65–0.80 | 套管接縫、膠帶 |
| UPW PVDF／化學 PFA | #D3D6CF | 0 | 0.28–0.45 | 隔膜閥、熔接三通、細管順彎，不套金屬法蘭風格 |
| 導電地板塗層 | #AEB8B8 | 0 | 0.34–0.46 | 600 mm 格網、微弱反射；近景真孔／遠景細節貼圖 |
| FOUP 外罩 | #AE6729 | 0 | 0.16–0.25 | 有厚度半透明殼；transmission 0.35–0.65 起測，暗色門板及底座 |
| 水泥／瀝青 | B07／B08 | 0 | 0.70–0.93 | 低幅 normal，潔淨區保持整潔 |
| 橡膠軟管／隔震墊 | #171D20 | 0 | 0.60–0.78 | 自然下垂、夾具及細環紋 |

主管表面呈不鏽鋼、保溫或 PVDF；工程色彩留在識別環、箭頭及標籤。沿用既有配色屬本案系統編碼，不宣稱符合特定法規色碼。Poly Haven `metal_plate` 已查明是舊綠漆鏽蝕菱形鋼板，不宜當潔淨室拉絲不鏽鋼。若不下載 Metal010，可用程序化各向異性細紋達成乾淨金屬外觀。

## 分層近景應具备的構造

- B1：低矮泵與高除害櫃有明顯尺度差異；真空波紋管、冷卻水双管、閥件、表頭、電纜托盤、支吊架、維修走道。
- 1F：600 mm 高架地板、機台門板／HMI／塔燈、FOUP load ports、FFU／照明分開、OHT 升降末端；微影區可局部使用 amber 光色。
- 2F：FFU 上方入口、接線盒、濾框、回風空間、桁架及維修平台；濾網本身不發光。
- RF：AHU/MAU 分段箱體、檢修門／把手、觀察窗、盤管雙接管、風機出口、雨罩、煙囪、格柵走道與護欄。

## 素材取得入口及核驗狀態

已下載 4K HDRI、混凝土及瀝青各三張 1K 材質圖，另下載 Metal010 2K ZIP 並提取 color／metalness／normalGL／roughness。共 47,679,725 bytes（含原始 ZIP）；7 個 Poly Haven 檔案的 MD5 均與原站 metadata 相符，10 張 JPG 均通過圖片解碼及尺寸檢查。各檔 SHA256、來源、授權與路徑已寫入 `out/digital_twin/assets/asset_sources.json`。是否已套用以主 Blender 任務及渲染結果為準。

| Asset | 入口 | 建議 |
|---|---|---|
| industrial_sunset_02_puresky | https://api.polyhaven.com/files/industrial_sunset_02_puresky | 4K HDR：https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/industrial_sunset_02_puresky_4k.hdr；16,086,915 bytes；原站 MD5 4622800e22ecc1b2930e03df65fb3a00 |
| concrete_floor_02 | https://api.polyhaven.com/files/concrete_floor_02 | 2K diffuse／roughness／nor_gl，近景可提高 4K |
| asphalt_02 | https://api.polyhaven.com/files/asphalt_02 | 2K diffuse／roughness／nor_gl，大面積增加低頻色差 |
| Metal010 | https://ambientcg.com/get?file=Metal010_2K-JPG.zip | optional；原站提供 ZIP，web reader 無法讀 ZIP，不表示一般下載失敗 |

OpenGL normal、roughness 及 metallic 設 Non-Color；albedo 設 sRGB；HDR/EXR 保留高動態。來源 ID、CAD ID、樓層、系統、inferred 狀態留在 metadata，以便替換實測設備。模型需要儲存近景、分層及整體渲染來核對效果。

本成果為依設計模型建立的視覺數位孿生。現場掃描、實測設備表及即時感測資料尚未提供，因此不等同已驗證 as-built 模型或已連線運行孿生。
