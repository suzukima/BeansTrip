import React, { useState, useEffect, useMemo } from "react";
import * as d3 from "d3";
import { Coffee, Plus, X, Star, Trash2, Pencil, MapPin, ChevronLeft, Leaf, LogOut, ZoomOut, List } from "lucide-react";
import { db, auth } from "./firebase";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";

/* --- 静的データ --- */
const COUNTRIES = [
  { region: "特殊", items: [["BLEND", "🌍 ブレンド（複数国）"]] },
  { region: "アフリカ", items: [
    ["ETH", "🇪🇹 エチオピア"], ["KEN", "🇰🇪 ケニア"], ["RWA", "🇷🇼 ルワンダ"], ["BDI", "🇧🇮 ブルンジ"],
    ["TZA", "🇹🇿 タンザニア"], ["UGA", "🇺🇬 ウガンダ"], ["COD", "🇨🇩 コンゴ民主共和国"], ["ZMB", "🇿🇲 ザンビア"],
    ["MWI", "🇲🇼 マラウイ"], ["CIV", "🇨🇮 コートジボワール"], ["AGO", "🇦🇴 アンゴラ"], ["STP", "🇸🇹 サントメ・プリンシペ"],
    ["MDG", "🇲🇬 マダガスカル"], ["YEM", "🇾🇪 イエメン"],
  ]},
  { region: "中南米・カリブ", items: [
    ["COL", "🇨🇴 コロンビア"], ["BRA", "🇧🇷 ブラジル"], ["PER", "🇵🇪 ペルー"], ["BOL", "🇧🇴 ボリビア"],
    ["ECU", "🇪🇨 エクアドル"], ["GTM", "🇬🇹 グアテマラ"], ["HND", "🇭🇳 ホンジュラス"], ["SLV", "🇸🇻 エルサルバドル"],
    ["NIC", "🇳🇮 ニカラグア"], ["CRI", "🇨🇷 コスタリカ"], ["PAN", "🇵🇦 パナマ"], ["MEX", "🇲🇽 メキシコ"],
    ["JAM", "🇯🇲 ジャマイカ"], ["CUB", "🇨🇺 キューバ"], ["DOM", "🇩🇴 ドミニカ共和国"], ["HTI", "🇭🇹 ハイチ"], ["VEN", "🇻🇪 ベネズエラ"],
  ]},
  { region: "アジア・オセアニア", items: [
    ["IDN", "🇮🇩 インドネシア"], ["VNM", "🇻🇳 ベトナム"], ["IND", "🇮🇳 インド"], ["CHN", "🇨🇳 中国"],
    ["PNG", "🇵🇬 パプアニューギニア"], ["THA", "🇹🇭 タイ"], ["MMR", "🇲🇲 ミャンマー"], ["LAO", "🇱🇦 ラオス"],
    ["PHL", "🇵🇭 フィリピン"], ["TLS", "🇹🇱 東ティモール"], ["NPL", "🇳🇵 ネパール"],
  ]},
  { region: "その他", items: [["USA", "🇺🇸 アメリカ（ハワイ）"]] },
];
const COUNTRY_NAME = Object.fromEntries(COUNTRIES.flatMap(r => r.items));

const ROASTS = [
  { id: "light", label: "浅煎り", color: "#D3C7BD" },
  { id: "medium-light", label: "中浅煎り", color: "#B3A295" },
  { id: "medium", label: "中煎り", color: "#8D7A6B" },
  { id: "medium-dark", label: "中深煎り", color: "#65483C" },
  { id: "dark", label: "深煎り", color: "#4A352D" },
];
const ROAST_MAP = Object.fromEntries(ROASTS.map(r => [r.id, r]));

const PROCESSES = ["ウォッシュド", "ナチュラル", "ハニー", "アナエロビック", "パルプドナチュラル", "不明/その他"];

const GEO_URL = "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson";

/* --- 画像リサイズ --- */
function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image decode failed"));
      img.onload = () => {
        const maxDim = 480;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const emptyBean = () => ({
  id: null,
  imageUrl: null,
  name: "",
  shop: "",
  purchaseDate: new Date().toISOString().slice(0, 10),
  countryCode: "",
  process: "",
  variety: "",
  altitude: "",
  notes: "",
  roast: "medium",
  isDecaf: false,
  isFavorite: false,
});

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      setAuthChecking(false);
    });
    return unsubscribe;
  }, []);

  const login = () => signInWithPopup(auth, new GoogleAuthProvider());
  const logout = () => signOut(auth);

  if (authChecking) return <div className="min-h-screen flex items-center justify-center bg-[#F4F9F8] text-[#8D7A6B]">確認中...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#F4F9F8]">
        <div className="flex items-center gap-2 mb-4">
          <Coffee size={32} style={{ color: "#65483C" }} />
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#65483C" }}>BeansTrip</h1>
        </div>
        <button onClick={login} className="px-6 py-3 rounded-full font-medium text-white shadow-sm hover:opacity-90 transition-opacity" style={{ background: "#00A7DE" }}>
          Googleでログイン
        </button>
      </div>
    );
  }

  return <CoffeeBeanJournal user={user} onLogout={logout} />;
}

function CoffeeBeanJournal({ user, onLogout }) {
  const [beans, setBeans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [tab, setTab] = useState("map");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyBean());
  const [detail, setDetail] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [filterCountry, setFilterCountry] = useState("");
  const [filterRoast, setFilterRoast] = useState("");
  const [filterShop, setFilterShop] = useState("");
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [filterDecaf, setFilterDecaf] = useState(false);

  const [geoFeatures, setGeoFeatures] = useState(null);
  const [activeCountry, setActiveCountry] = useState(null);
  const [mapTransform, setMapTransform] = useState({ k: 1, x: 0, y: 0 });

  useEffect(() => {
    (async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "beans"));
        const loaded = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setBeans(loaded);
      } catch (e) {
        setErrorMsg("データの読み込みに失敗しました。");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    fetch(GEO_URL)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP Error ${r.status}`);
        return r.json();
      })
      .then(data => {
        const filtered = data.features.filter(f => (f.id || f.properties?.iso_a3 || f.properties?.ISO_A3) !== "ATA");
        setGeoFeatures(filtered);
      })
      .catch(e => console.error("地図データの読み込みに失敗しました:", e));
  }, []);

  const countryCounts = useMemo(() => {
    const m = {};
    beans.forEach(b => {
      if (b.countryCode && b.countryCode !== "BLEND") {
        m[b.countryCode] = (m[b.countryCode] || 0) + 1;
      }
    });
    return m;
  }, [beans]);

  const usedCountryCodes = useMemo(
    () => Object.keys(countryCounts).sort((a, b) => (COUNTRY_NAME[a] || a).localeCompare(COUNTRY_NAME[b] || b, "ja")),
    [countryCounts]
  );
  
  const usedShops = useMemo(() => Array.from(new Set(beans.map(b => b.shop).filter(Boolean))).sort(), [beans]);

  const maxCount = Math.max(1, ...Object.values(countryCounts));
  
  const colorScale = useMemo(
    () => d3.scaleSequential().domain([0, maxCount]).interpolator(d3.interpolateRgb("#B3A295", "#65483C")),
    [maxCount]
  );

  const filteredBeans = useMemo(() => {
    return beans
      .filter(b => !filterCountry || b.countryCode === filterCountry)
      .filter(b => !filterRoast || b.roast === filterRoast)
      .filter(b => !filterShop || b.shop === filterShop)
      .filter(b => !filterFavorite || b.isFavorite)
      .filter(b => !filterDecaf || b.isDecaf)
      .sort((a, b) => (b.purchaseDate || "").localeCompare(a.purchaseDate || "") || (b.createdAt || 0) - (a.createdAt || 0));
  }, [beans, filterCountry, filterRoast, filterShop, filterFavorite, filterDecaf]);

  const mapDims = { w: 800, h: 500 }; 
  const projection = useMemo(() => {
    if (!geoFeatures) return null;
    const proj = d3.geoNaturalEarth1().fitSize([mapDims.w, mapDims.h], { type: "FeatureCollection", features: geoFeatures });
    proj.scale(proj.scale() * 1.3);
    proj.translate([mapDims.w / 2, mapDims.h / 2 + 40]);
    return proj;
  }, [geoFeatures]);
  
  const pathGen = useMemo(() => (projection ? d3.geoPath(projection) : null), [projection]);

  const focusCountry = (code) => {
    if (!code || !geoFeatures || !pathGen) {
      setActiveCountry(null);
      setMapTransform({ k: 1, x: 0, y: 0 }); 
      return;
    }
    const feature = geoFeatures.find(f => (f.id || f.properties?.iso_a3 || f.properties?.ISO_A3) === code);
    if (feature) {
      setActiveCountry(code);
      const [[x0, y0], [x1, y1]] = pathGen.bounds(feature);
      const cw = x1 - x0;
      const ch = y1 - y0;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const k = Math.min(8, 0.6 / Math.max(cw / mapDims.w, ch / mapDims.h));
      const x = mapDims.w / 2 - k * cx;
      const y = mapDims.h / 2 - k * cy;
      setMapTransform({ k, x, y });
    }
  };

  const handleCountrySelect = (code) => {
    if (activeCountry === code) {
      focusCountry(null); 
    } else {
      focusCountry(code);
    }
  };

  const jumpToList = (code) => {
    setFilterCountry(code);
    setFilterRoast("");
    setFilterShop("");
    setFilterFavorite(false);
    setFilterDecaf(false);
    setTab("list");
  };

  const openNewForm = () => { setForm(emptyBean()); setFormOpen(true); setErrorMsg(""); };
  const openEditForm = (bean) => { setForm(JSON.parse(JSON.stringify(bean))); setDetail(null); setFormOpen(true); setErrorMsg(""); };

  const handleImagePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file);
      setForm(f => ({ ...f, imageUrl: dataUrl }));
    } catch (e) {}
  };

  const saveForm = async () => {
    if (!form.name.trim() || !form.countryCode) return;
    setSaving(true);
    setErrorMsg("");
    try {
      const record = { ...form, createdAt: form.createdAt || Date.now() };
      delete record.id; 
      const docRef = form.id ? doc(db, "beans", form.id) : doc(collection(db, "beans"));
      await setDoc(docRef, record, { merge: true });
      const savedBean = { id: docRef.id, ...record };
      setBeans(prev => {
        const exists = prev.some(b => b.id === savedBean.id);
        return exists ? prev.map(b => (b.id === savedBean.id ? savedBean : b)) : [savedBean, ...prev];
      });
      setFormOpen(false);
    } catch (e) {
      setErrorMsg("保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  const deleteBean = async (id) => {
    try {
      await deleteDoc(doc(db, "beans", id));
      setBeans(prev => prev.filter(b => b.id !== id));
      setConfirmDeleteId(null);
      setDetail(null);
    } catch (e) {
      setErrorMsg("削除に失敗しました。");
    }
  };

  const toggleFavorite = async (bean) => {
    const nextVal = !bean.isFavorite;
    setBeans(prev => prev.map(b => (b.id === bean.id ? { ...b, isFavorite: nextVal } : b)));
    setDetail(d => (d && d.id === bean.id ? { ...d, isFavorite: nextVal } : d));
    try {
      await setDoc(doc(db, "beans", bean.id), { isFavorite: nextVal }, { merge: true });
    } catch (e) {}
  };

  return (
    <div className="w-full min-h-screen" style={{ background: "#F4F9F8", color: "#65483C", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .bean-scroll::-webkit-scrollbar { width: 6px; }
        .bean-scroll::-webkit-scrollbar-thumb { background: #94D1CA; border-radius: 4px; }
        input, select, textarea { font-family: 'Inter', system-ui, sans-serif; font-size: 16px; }
        .country-path { cursor: pointer; stroke: #FFFFFF; stroke-width: 0.75; transition: fill 0.3s ease, opacity 0.3s ease; }
        .country-path:hover { opacity: 0.8; stroke-width: 1.5; }
      `}</style>

      <header className="px-5 pt-6 pb-4 flex items-center justify-between max-w-3xl mx-auto">
        <div>
          <div className="flex items-center gap-2">
            <Coffee size={20} style={{ color: "#65483C" }} />
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#65483C" }}>BeansTrip</h1>
          </div>
          <p className="text-xs mt-1" style={{ color: "#8D7A6B" }}>その豆の由来を地図に記す</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onLogout} className="p-2 rounded-full hover:bg-[#E8F4F2]" style={{ color: "#8D7A6B" }}><LogOut size={16} /></button>
          <button onClick={openNewForm} className="flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity" style={{ background: "#00A7DE" }}>
            <Plus size={16} /> 記録
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 flex gap-2 mb-4">
        {[["map", "地図"], ["list", "履歴"]].map(([id, label]) => (
          <button
            key={id} onClick={() => setTab(id)}
            className="px-5 py-1.5 rounded-full text-sm font-medium transition-colors"
            style={{ background: tab === id ? "#00A7DE" : "transparent", color: tab === id ? "#FFFFFF" : "#8D7A6B", border: "1px solid " + (tab === id ? "#00A7DE" : "transparent") }}
          >
            {label}
          </button>
        ))}
      </div>

      <main className="max-w-3xl mx-auto px-5 pb-28">
        {loading ? (
          <p className="text-sm" style={{ color: "#8D7A6B" }}>データを読み込み中…</p>
        ) : tab === "map" ? (
          <div>
            <div className="relative rounded-2xl overflow-hidden mb-4 shadow-sm" style={{ background: "#FFFFFF", border: "1px solid #94D1CA" }}>
              {!geoFeatures || !pathGen ? (
                <div className="py-24 text-center text-sm" style={{ color: "#8D7A6B" }}>地図を読み込み中…</div>
              ) : (
                <>
                  <svg viewBox={`0 0 ${mapDims.w} ${mapDims.h}`} className="w-full h-auto" onClick={(e) => { if (e.target.tagName === 'svg') focusCountry(null); }}>
                    <g transform="translate(10,10)">
                      <g style={{ transform: `translate(${mapTransform.x}px, ${mapTransform.y}px) scale(${mapTransform.k})`, transformOrigin: "0 0", transition: "transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)" }}>
                        {geoFeatures.map((f, i) => {
                          const code = f.id || f.properties?.iso_a3 || f.properties?.ISO_A3;
                          const count = code ? countryCounts[code] || 0 : 0;
                          
                          let fill = "#CDE0DD"; 
                          let opacity = 1;
                          if (count > 0) {
                            fill = activeCountry === code ? "#00A7DE" : colorScale(count);
                          }
                          if (activeCountry && activeCountry !== code) {
                            opacity = 0.3; 
                          }

                          return (
                            <path
                              key={i} d={pathGen(f)} className="country-path" fill={fill} opacity={opacity}
                              onClick={() => count > 0 && handleCountrySelect(code)}
                            />
                          );
                        })}
                      </g>
                    </g>
                  </svg>

                  {activeCountry && (
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                      <button onClick={() => focusCountry(null)} className="pointer-events-auto p-2.5 rounded-full shadow-md bg-white hover:bg-gray-50 transition-colors" style={{ color: "#65483C" }}>
                        <ZoomOut size={20} />
                      </button>
                      <button onClick={() => jumpToList(activeCountry)} className="pointer-events-auto flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium text-white shadow-md hover:opacity-90 transition-opacity" style={{ background: "#00A7DE" }}>
                        <List size={16} /> {COUNTRY_NAME[activeCountry]}の記録を見る
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {usedCountryCodes.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-medium mb-2" style={{ color: "#8D7A6B" }}>記録のある国（タップでズーム）</p>
                <div className="flex flex-wrap gap-2">
                  {usedCountryCodes.map(code => (
                    <button
                      key={code}
                      onClick={() => handleCountrySelect(code)}
                      className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors shadow-sm"
                      style={{ 
                        background: activeCountry === code ? "#00A7DE" : "#FFFFFF", 
                        color: activeCountry === code ? "#FFFFFF" : "#65483C",
                        border: `1px solid ${activeCountry === code ? "#00A7DE" : "#94D1CA"}`
                      }}
                    >
                      {COUNTRY_NAME[code]} <span style={{ opacity: 0.7 }}>{countryCounts[code]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <p className="text-xs text-right" style={{ color: "#8D7A6B" }}>全 {beans.length} 件</p>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap gap-2 mb-5">
              <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)} className="text-xs px-3 py-1.5 rounded-full outline-none" style={{ background: "#FFFFFF", color: "#65483C", border: "1px solid #94D1CA" }}>
                <option value="">生産国：すべて</option>
                {usedCountryCodes.map(c => <option key={c} value={c}>{COUNTRY_NAME[c] || c}</option>)}
                <option value="BLEND">ブレンド</option>
              </select>
              <select value={filterRoast} onChange={e => setFilterRoast(e.target.value)} className="text-xs px-3 py-1.5 rounded-full outline-none" style={{ background: "#FFFFFF", color: "#65483C", border: "1px solid #94D1CA" }}>
                <option value="">焙煎度：すべて</option>
                {ROASTS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              <select value={filterShop} onChange={e => setFilterShop(e.target.value)} className="text-xs px-3 py-1.5 rounded-full outline-none" style={{ background: "#FFFFFF", color: "#65483C", border: "1px solid #94D1CA" }}>
                <option value="">購入店：すべて</option>
                {usedShops.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => setFilterDecaf(v => !v)} className="text-base px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors" style={{ background: filterDecaf ? "#94D1CA" : "#FFFFFF", color: filterDecaf ? "#FFFFFF" : "#65483C", border: "1px solid #94D1CA" }}>
                <Leaf size={16} /> デカフェ
              </button>
              <button onClick={() => setFilterFavorite(v => !v)} className="text-base px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors" style={{ background: filterFavorite ? "#FFC107" : "#FFFFFF", color: filterFavorite ? "#FFFFFF" : "#65483C", border: filterFavorite ? "1px solid #FFC107" : "1px solid #94D1CA" }}>
                <Star size={16} fill={filterFavorite ? "#FFFFFF" : "none"} /> お気に入り
              </button>
              {(filterCountry || filterRoast || filterShop || filterFavorite || filterDecaf) && (
                <button onClick={() => { setFilterCountry(""); setFilterRoast(""); setFilterShop(""); setFilterFavorite(false); setFilterDecaf(false); }} className="text-base px-3 py-1.5" style={{ color: "#8D7A6B" }}>クリア</button>
              )}
            </div>

            <p className="text-xs mb-3" style={{ color: "#8D7A6B" }}>{filteredBeans.length} 件 / 全 {beans.length} 件</p>
            {filteredBeans.length === 0 ? (
              <p className="text-sm text-center py-10" style={{ color: "#8D7A6B" }}>該当する記録がありません。</p>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredBeans.map(bean => {
                  const roast = ROAST_MAP[bean.roast];
                  return (
                    <button key={bean.id} onClick={() => setDetail(bean)} className="flex items-center gap-3 p-3 rounded-xl text-left shadow-sm hover:shadow-md transition-shadow" style={{ background: "#FFFFFF", border: "1px solid #E8F4F2" }}>
                      <div className="w-14 h-14 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ background: "#94D1CA" }}>
                        {bean.imageUrl ? <img src={bean.imageUrl} alt="" className="w-full h-full object-cover" /> : <Coffee size={22} style={{ color: "#FFFFFF" }} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <p className="text-base font-bold truncate" style={{ color: "#65483C" }}>{bean.name}</p>
                          {bean.isFavorite && <Star size={14} fill="#FFC107" style={{ color: "#FFC107", flexShrink: 0 }} />}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs truncate" style={{ color: "#8D7A6B" }}>{COUNTRY_NAME[bean.countryCode] || bean.countryCode}{bean.shop ? ` ・ ${bean.shop}` : ""}</p>
                          {bean.isDecaf && <Leaf size={12} style={{ color: "#94D1CA" }} />}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: roast?.color, color: bean.roast === 'dark' || bean.roast === 'medium-dark' || bean.roast === 'medium' ? "#FFFFFF" : "#65483C" }}>{roast?.label}</span>
                        <span className="text-xs" style={{ color: "#8D7A6B" }}>{bean.purchaseDate}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5" style={{ background: "rgba(101, 72, 60, 0.4)" }} onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} className="bean-scroll rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto shadow-xl" style={{ background: "#FFFFFF" }}>
            <div className="p-5">
              <div className="flex justify-between items-start mb-4">
                <button onClick={() => setDetail(null)} className="p-1 -ml-1 hover:bg-[#E8F4F2] rounded-full" style={{ color: "#8D7A6B" }}><ChevronLeft size={24} /></button>
                <div className="flex gap-2">
                  <button onClick={() => toggleFavorite(detail)} className="p-2 rounded-full hover:bg-[#E8F4F2]" style={{ color: detail.isFavorite ? "#FFC107" : "#8D7A6B" }}><Star size={20} fill={detail.isFavorite ? "#FFC107" : "none"} /></button>
                  <button onClick={() => openEditForm(detail)} className="p-2 rounded-full hover:bg-[#E8F4F2]" style={{ color: "#00A7DE" }}><Pencil size={18} /></button>
                  <button onClick={() => setConfirmDeleteId(detail.id)} className="p-2 rounded-full hover:bg-[#FDE8E4]" style={{ color: "#E05A5A" }}><Trash2 size={18} /></button>
                </div>
              </div>
              {detail.imageUrl && <img src={detail.imageUrl} alt="" className="w-full h-56 object-contain bg-[#F4F9F8] rounded-xl mb-5" />}
              <h2 className="text-2xl font-bold mb-2" style={{ color: "#65483C" }}>{detail.name}</h2>
              <div className="flex items-center gap-2 mb-6 flex-wrap">
                <span className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-medium" style={{ background: ROAST_MAP[detail.roast]?.color, color: detail.roast === 'dark' || detail.roast === 'medium-dark' || detail.roast === 'medium' ? "#FFFFFF" : "#65483C" }}>
                  <MapPin size={12} /> {ROAST_MAP[detail.roast]?.label}
                </span>
                {detail.isDecaf && (
                  <span className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-medium" style={{ background: "#94D1CA", color: "#FFFFFF" }}>
                    <Leaf size={12} /> デカフェ
                  </span>
                )}
                <span className="text-sm font-medium" style={{ color: "#8D7A6B" }}>{detail.purchaseDate}</span>
              </div>
              {[{l: "生産国", v: COUNTRY_NAME[detail.countryCode] || detail.countryCode}, {l: "購入店", v: detail.shop}, {l: "精製方法", v: detail.process}, {l: "品種", v: detail.variety}, {l: "標高", v: detail.altitude}, {l: "味のメモ", v: detail.notes}].map(r => r.v && (
                <div key={r.l} className="py-3" style={{ borderTop: "1px solid #E8F4F2" }}>
                  <p className="text-xs font-medium mb-1" style={{ color: "#8D7A6B" }}>{r.l}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "#65483C", whiteSpace: "pre-wrap" }}>{r.v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5" style={{ background: "rgba(101, 72, 60, 0.4)" }} onClick={() => setConfirmDeleteId(null)}>
          <div onClick={e => e.stopPropagation()} className="p-6 rounded-2xl max-w-xs w-full shadow-xl" style={{ background: "#FFFFFF" }}>
            <p className="text-base font-medium mb-6 text-center text-[#65483C]">この記録を削除しますか？</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2.5 rounded-full text-sm font-medium" style={{ color: "#8D7A6B", background: "#E8F4F2" }}>やめる</button>
              <button onClick={() => deleteBean(confirmDeleteId)} className="flex-1 py-2.5 rounded-full text-sm font-medium text-white shadow-sm" style={{ background: "#E05A5A" }}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5" style={{ background: "rgba(101, 72, 60, 0.4)" }} onClick={() => setFormOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="bean-scroll rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl" style={{ background: "#FFFFFF" }}>
            <div className="p-5">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-bold text-[#65483C]">{form.id ? "記録を編集" : "新しい記録"}</h2>
                <button onClick={() => setFormOpen(false)} className="p-1 hover:bg-[#E8F4F2] rounded-full"><X size={20} style={{ color: "#8D7A6B" }} /></button>
              </div>
              
              <label className="block w-full h-40 rounded-xl mb-5 flex flex-col items-center justify-center overflow-hidden cursor-pointer bg-[#F4F9F8] hover:bg-[#E8F4F2] transition-colors" style={{ border: "2px dashed #94D1CA" }}>
                {form.imageUrl ? <img src={form.imageUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-sm font-medium" style={{ color: "#00A7DE" }}>+ 写真を追加</span>}
                <input type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
              </label>

              <div className="mb-4">
                <p className="text-xs font-medium mb-1.5" style={{ color: "#8D7A6B" }}>銘柄・商品名 *</p>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none focus:border-[#00A7DE]" style={{ background: "#FFFFFF", color: "#65483C", border: "1px solid #94D1CA" }} />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-xs font-medium mb-1.5" style={{ color: "#8D7A6B" }}>購入店</p>
                  <input list="shop-list" value={form.shop} onChange={e => setForm(f => ({ ...f, shop: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none focus:border-[#00A7DE]" style={{ background: "#FFFFFF", color: "#65483C", border: "1px solid #94D1CA" }} />
                  <datalist id="shop-list">
                    {usedShops.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1.5" style={{ color: "#8D7A6B" }}>購入日</p>
                  <input type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none focus:border-[#00A7DE]" style={{ background: "#FFFFFF", color: "#65483C", border: "1px solid #94D1CA" }} />
                </div>
              </div>

              <div className="mb-4">
                <p className="text-xs font-medium mb-1.5" style={{ color: "#8D7A6B" }}>生産国 *</p>
                <select value={form.countryCode} onChange={e => setForm(f => ({ ...f, countryCode: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none focus:border-[#00A7DE]" style={{ background: "#FFFFFF", color: "#65483C", border: "1px solid #94D1CA" }}>
                  <option value="">選択してください</option>
                  {COUNTRIES.map(g => (
                    <optgroup key={g.region} label={g.region}>
                      {g.items.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-xs font-medium mb-1.5" style={{ color: "#8D7A6B" }}>精製方法</p>
                  <select value={form.process} onChange={e => setForm(f => ({ ...f, process: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none focus:border-[#00A7DE]" style={{ background: "#FFFFFF", color: "#65483C", border: "1px solid #94D1CA" }}>
                    <option value="">選択してください</option>
                    {PROCESSES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1.5" style={{ color: "#8D7A6B" }}>品種</p>
                  <input value={form.variety} onChange={e => setForm(f => ({ ...f, variety: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none focus:border-[#00A7DE]" style={{ background: "#FFFFFF", color: "#65483C", border: "1px solid #94D1CA" }} />
                </div>
              </div>

              <div className="mb-5">
                <p className="text-xs font-medium mb-2" style={{ color: "#8D7A6B" }}>焙煎度</p>
                <div className="flex gap-1.5 flex-wrap">
                  {ROASTS.map(r => (
                    <button key={r.id} onClick={() => setForm(f => ({ ...f, roast: r.id }))} className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors" style={{ background: form.roast === r.id ? r.color : "#FFFFFF", color: form.roast === r.id && (r.id === 'dark' || r.id === 'medium-dark' || r.id === 'medium') ? "#FFFFFF" : "#65483C", border: form.roast === r.id ? "1px solid transparent" : "1px solid #94D1CA" }}>{r.label}</button>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <p className="text-xs font-medium mb-1.5" style={{ color: "#8D7A6B" }}>味のメモ</p>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none focus:border-[#00A7DE]" style={{ background: "#FFFFFF", color: "#65483C", border: "1px solid #94D1CA" }} />
              </div>

              <div className="flex gap-5 mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isDecaf} onChange={e => setForm(f => ({ ...f, isDecaf: e.target.checked }))} className="w-4 h-4 accent-[#94D1CA]" />
                  <span className="text-sm font-medium flex items-center gap-1 text-[#65483C]"><Leaf size={16} style={{ color: "#94D1CA" }} /> デカフェ</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isFavorite} onChange={e => setForm(f => ({ ...f, isFavorite: e.target.checked }))} className="w-4 h-4 accent-[#FFC107]" />
                  <span className="text-sm font-medium flex items-center gap-1 text-[#65483C]"><Star size={16} style={{ color: "#FFC107" }} /> お気に入り</span>
                </label>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setFormOpen(false)} className="flex-1 py-3 rounded-full text-sm font-medium" style={{ border: "1px solid #94D1CA", color: "#8D7A6B", background: "#FFFFFF" }}>キャンセル</button>
                <button onClick={saveForm} disabled={saving || !form.name.trim() || !form.countryCode} className="flex-1 py-3 rounded-full text-sm font-medium text-white shadow-sm disabled:opacity-40 hover:opacity-90 transition-opacity" style={{ background: "#00A7DE" }}>
                  {saving ? "保存中..." : "保存する"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}