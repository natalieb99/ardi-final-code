import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyBq34c84ZEiaM9cYQMDaanOTnXhcZpSvAU", // Restored your original API key
  authDomain: "ardi-7bcff.firebaseapp.com",
  projectId: "ardi-7bcff",
  storageBucket: "ardi-7bcff.firebasestorage.app",
  messagingSenderId: "145648454690",
  appId: "1:145648454690:web:f2b139bfee26080a87ce7b",
  measurementId: "G-NX8VRL6BWL"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

let currentUser = null;
let unsubPlots = null;
let unsubJournal = null;

// Global cache for Live Crop Production Statistics
window.globalLiveCropStats = [];
getDocs(collection(db, "crop_production_stats"))
  .then(snapshot => {
    window.globalLiveCropStats = snapshot.docs.map(doc => doc.data());
    if (typeof window.triggerZoneAutoSelect === "function") {
      window.triggerZoneAutoSelect(); // Auto-select best crop using real data once loaded
    } else if (typeof window.updateEstimatorFn === "function") {
      window.updateEstimatorFn();
    }
  })
  .catch(err => console.error("Could not fetch live crop stats:", err));

// Automatically copies existing local data into the user's cloud account on first login
async function migrateLocalDataToCloud(user) {
  const localPlots = JSON.parse(localStorage.getItem("ardiPlots") || "[]");
  if (localPlots.length > 0) {
    for (const p of localPlots) {
      await addDoc(collection(db, "users", user.uid, "plots"), { ...p, createdAt: serverTimestamp() });
    }
    localStorage.removeItem("ardiPlots");
  }
  const localJournal = JSON.parse(localStorage.getItem("ardiJournal") || "[]");
  if (localJournal.length > 0) {
    for (const j of localJournal) {
      await addDoc(collection(db, "users", user.uid, "journal"), { ...j, createdAt: serverTimestamp() });
    }
    localStorage.removeItem("ardiJournal");
  }
}

const cropDatabase = [
  {
    nameEn: "Tomato",
    nameAr: "طماطم",
    zoneFit: ["jordan-valley", "irbid"],
    soilFit: ["loamy", "clay"],
    waterFit: ["well", "irrigation-network"],
    seasons: ["spring", "summer"],
    avgYieldPerDunamKg: 7200,
    avgPriceJodPerKg: 0.25,
    avgCostPerDunamJod: 900,
    art: "art-tomato",
    color: "#E76F51",
    waterNeed: "high",
    marketStrength: "high",
    resilience: "medium"
  },
  {
    nameEn: "Olive",
    nameAr: "زيتون",
    zoneFit: ["ajloun", "irbid"],
    soilFit: ["calcareous", "clay", "loamy"],
    waterFit: ["rainfed", "well"],
    seasons: ["winter", "spring"],
    avgYieldPerDunamKg: 650,
    avgPriceJodPerKg: 1.8,
    avgCostPerDunamJod: 180,
    art: "art-olive",
    color: "#43A047",
    waterNeed: "low",
    marketStrength: "medium",
    resilience: "high"
  },
  {
    nameEn: "Wheat",
    nameAr: "قمح",
    zoneFit: ["mafraq", "ajloun", "irbid"],
    soilFit: ["loamy", "calcareous"],
    waterFit: ["rainfed"],
    seasons: ["winter"],
    avgYieldPerDunamKg: 260,
    avgPriceJodPerKg: 0.3,
    avgCostPerDunamJod: 48,
    art: "art-wheat",
    color: "#E9C46A",
    waterNeed: "low",
    marketStrength: "low",
    resilience: "high"
  },
  {
    nameEn: "Barley",
    nameAr: "شعير",
    zoneFit: ["mafraq", "ajloun"],
    soilFit: ["calcareous", "sandy"],
    waterFit: ["rainfed"],
    seasons: ["winter"],
    avgYieldPerDunamKg: 230,
    avgPriceJodPerKg: 0.24,
    avgCostPerDunamJod: 40,
    art: "art-barley",
    color: "#F4A261",
    waterNeed: "low",
    marketStrength: "low",
    resilience: "high"
  },
  {
    nameEn: "Pomegranate",
    nameAr: "رمان",
    zoneFit: ["ajloun", "irbid", "jordan-valley"],
    soilFit: ["loamy", "clay"],
    waterFit: ["well", "irrigation-network"],
    seasons: ["spring", "autumn"],
    avgYieldPerDunamKg: 1150,
    avgPriceJodPerKg: 1.2,
    avgCostPerDunamJod: 350,
    art: "art-pomegranate",
    color: "#E63946",
    waterNeed: "medium",
    marketStrength: "medium",
    resilience: "medium"
  },
  {
    nameEn: "Zaatar",
    nameAr: "زعتر",
    zoneFit: ["mafraq", "ajloun", "aqaba"],
    soilFit: ["sandy", "calcareous", "loamy"],
    waterFit: ["rainfed", "well"],
    seasons: ["autumn", "spring"],
    avgYieldPerDunamKg: 420,
    avgPriceJodPerKg: 3.1,
    avgCostPerDunamJod: 190,
    art: "art-zaatar",
    color: "#8AB17D",
    waterNeed: "low",
    marketStrength: "high",
    resilience: "high"
  }
  ,{
    nameEn: "Dates",
    nameAr: "تمور",
    zoneFit: ["jordan-valley", "aqaba"],
    soilFit: ["sandy", "loamy"],
    waterFit: ["well", "irrigation-network"],
    seasons: ["summer", "autumn"],
    avgYieldPerDunamKg: 1500,
    avgPriceJodPerKg: 2.5,
    avgCostPerDunamJod: 200,
    art: "art-date",
    color: "#9a6e35",
    waterNeed: "high",
    marketStrength: "high",
    resilience: "high"
  },
  {
    nameEn: "Bananas",
    nameAr: "موز",
    zoneFit: ["jordan-valley"],
    soilFit: ["loamy", "clay"],
    waterFit: ["irrigation-network"],
    seasons: ["summer", "autumn", "spring"],
    avgYieldPerDunamKg: 3800,
    avgPriceJodPerKg: 0.7,
    avgCostPerDunamJod: 400,
    art: "art-banana",
    color: "#E9C46A",
    waterNeed: "high",
    marketStrength: "medium",
    resilience: "medium"
  },
  {
    nameEn: "Strawberries",
    nameAr: "فراولة",
    zoneFit: ["balqa", "amman", "mafraq"],
    soilFit: ["loamy", "sandy"],
    waterFit: ["well", "irrigation-network"],
    seasons: ["spring", "winter"],
    avgYieldPerDunamKg: 2800,
    avgPriceJodPerKg: 1.5,
    avgCostPerDunamJod: 600,
    art: "art-strawberry",
    color: "#E63946",
    waterNeed: "high",
    marketStrength: "high",
    resilience: "low"
  },
  {
    nameEn: "Garlic",
    nameAr: "ثوم",
    zoneFit: ["irbid", "mafraq", "karak"],
    soilFit: ["loamy", "calcareous"],
    waterFit: ["rainfed", "well"],
    seasons: ["winter", "spring"],
    avgYieldPerDunamKg: 2800,
    avgPriceJodPerKg: 1.2,
    avgCostPerDunamJod: 300,
    art: "art-garlic",
    color: "#FDF2D5",
    waterNeed: "medium",
    marketStrength: "high",
    resilience: "high"
  }
  ,
  {
    nameEn: "Grapes",
    nameAr: "عنب",
    zoneFit: ["karak", "tafilah", "amman", "balqa", "irbid", "ajloun"],
    soilFit: ["loamy", "calcareous", "sandy"],
    waterFit: ["rainfed", "well"],
    seasons: ["summer", "autumn"],
    avgYieldPerDunamKg: 2400,
    avgPriceJodPerKg: 0.8,
    avgCostPerDunamJod: 450,
    art: "art-grapes",
    color: "#6f42c1",
    waterNeed: "medium",
    marketStrength: "medium",
    resilience: "medium"
  },
  {
    nameEn: "Cucumber",
    nameAr: "خيار",
    zoneFit: ["jordan-valley", "balqa", "zarqa", "mafraq", "irbid"],
    soilFit: ["loamy", "sandy"],
    waterFit: ["well", "irrigation-network"],
    seasons: ["spring", "summer"],
    avgYieldPerDunamKg: 8500,
    avgPriceJodPerKg: 0.35,
    avgCostPerDunamJod: 850,
    art: "art-cucumber",
    color: "#2a9d8f",
    waterNeed: "high",
    marketStrength: "high",
    resilience: "low"
  },
  {
    nameEn: "Potatoes",
    nameAr: "بطاطا",
    zoneFit: ["balqa", "amman", "irbid", "zarqa", "mafraq", "maan"],
    soilFit: ["sandy", "loamy"],
    waterFit: ["well", "irrigation-network"],
    seasons: ["spring", "autumn"],
    avgYieldPerDunamKg: 4200,
    avgPriceJodPerKg: 0.4,
    avgCostPerDunamJod: 700,
    art: "art-potato",
    color: "#dda15e",
    waterNeed: "medium",
    marketStrength: "high",
    resilience: "medium"
  },
  {
    nameEn: "Lentils",
    nameAr: "عدس",
    zoneFit: ["irbid", "mafraq", "balqa", "karak"],
    soilFit: ["loamy", "clay"],
    waterFit: ["rainfed"],
    seasons: ["winter"],
    avgYieldPerDunamKg: 125,
    avgPriceJodPerKg: 0.9,
    avgCostPerDunamJod: 55,
    art: "art-lentils",
    color: "#bc6c25",
    waterNeed: "low",
    marketStrength: "medium",
    resilience: "high"
  },
  {
    nameEn: "Citrus",
    nameAr: "حمضيات",
    zoneFit: ["aqaba", "karak", "balqa", "amman", "jordan-valley"],
    soilFit: ["loamy", "sandy"],
    waterFit: ["irrigation-network", "well"],
    seasons: ["winter", "spring"],
    avgYieldPerDunamKg: 4500,
    avgPriceJodPerKg: 0.6,
    avgCostPerDunamJod: 350,
    art: "art-citrus",
    color: "#F4A261",
    waterNeed: "high",
    marketStrength: "medium",
    resilience: "medium"
  },
  {
    nameEn: "Eggplant",
    nameAr: "باذنجان",
    zoneFit: ["balqa", "zarqa", "mafraq"],
    soilFit: ["loamy", "sandy", "clay"],
    waterFit: ["well", "irrigation-network"],
    seasons: ["summer", "spring"],
    avgYieldPerDunamKg: 6200,
    avgPriceJodPerKg: 0.4,
    avgCostPerDunamJod: 600,
    art: "art-eggplant",
    color: "#4a4e69",
    waterNeed: "high",
    marketStrength: "high",
    resilience: "low"
  },
  {
    nameEn: "Watermelon",
    nameAr: "بطيخ",
    zoneFit: ["mafraq", "zarqa", "balqa", "irbid", "jordan-valley"],
    soilFit: ["sandy", "loamy"],
    waterFit: ["well", "irrigation-network"],
    seasons: ["summer"],
    avgYieldPerDunamKg: 7500,
    avgPriceJodPerKg: 0.25,
    avgCostPerDunamJod: 500,
    art: "art-watermelon",
    color: "#E63946",
    waterNeed: "high",
    marketStrength: "high",
    resilience: "low"
  },
  {
    nameEn: "Cauliflower",
    nameAr: "قرنبيط",
    zoneFit: ["balqa", "irbid", "zarqa", "amman"],
    soilFit: ["loamy", "clay"],
    waterFit: ["well", "irrigation-network"],
    seasons: ["winter", "autumn"],
    avgYieldPerDunamKg: 6500,
    avgPriceJodPerKg: 0.4,
    avgCostPerDunamJod: 400,
    art: "art-cauliflower",
    color: "#f1faee",
    waterNeed: "medium",
    marketStrength: "medium",
    resilience: "medium"
  },
  {
    nameEn: "Figs",
    nameAr: "تين",
    zoneFit: ["ajloun", "jerash", "irbid", "karak", "tafilah"],
    soilFit: ["calcareous", "loamy", "sandy"],
    waterFit: ["rainfed", "well"],
    seasons: ["summer"],
    avgYieldPerDunamKg: 850,
    avgPriceJodPerKg: 1.5,
    avgCostPerDunamJod: 250,
    art: "art-figs",
    color: "#5e3c58",
    waterNeed: "low",
    marketStrength: "high",
    resilience: "high"
  },
  {
    nameEn: "Almonds",
    nameAr: "لوز",
    zoneFit: ["karak", "tafilah", "ajloun", "jerash", "balqa"],
    soilFit: ["calcareous", "loamy"],
    waterFit: ["rainfed", "well"],
    seasons: ["spring"],
    avgYieldPerDunamKg: 210,
    avgPriceJodPerKg: 3.5,
    avgCostPerDunamJod: 300,
    art: "art-almonds",
    color: "#d4a373",
    waterNeed: "medium",
    marketStrength: "high",
    resilience: "medium"
  },
  {
    nameEn: "Onions",
    nameAr: "بصل",
    zoneFit: ["mafraq", "balqa", "zarqa", "irbid"],
    soilFit: ["sandy", "loamy"],
    waterFit: ["well", "irrigation-network"],
    seasons: ["winter", "spring"],
    avgYieldPerDunamKg: 5800,
    avgPriceJodPerKg: 0.35,
    avgCostPerDunamJod: 450,
    art: "art-onions",
    color: "#E9C46A",
    waterNeed: "medium",
    marketStrength: "high",
    resilience: "high"
  },
  {
    nameEn: "Squash",
    nameAr: "كوسا",
    zoneFit: ["balqa", "zarqa", "mafraq", "irbid"],
    soilFit: ["loamy", "sandy"],
    waterFit: ["well", "irrigation-network"],
    seasons: ["summer", "spring"],
    avgYieldPerDunamKg: 6800,
    avgPriceJodPerKg: 0.5,
    avgCostPerDunamJod: 650,
    art: "art-squash",
    color: "#8AB17D",
    waterNeed: "medium",
    marketStrength: "high",
    resilience: "low"
  },
  {
    nameEn: "Pepper",
    nameAr: "فلفل",
    zoneFit: ["balqa", "zarqa", "mafraq", "irbid"],
    soilFit: ["loamy", "sandy", "clay"],
    waterFit: ["well", "irrigation-network"],
    seasons: ["summer", "spring"],
    avgYieldPerDunamKg: 6400,
    avgPriceJodPerKg: 0.6,
    avgCostPerDunamJod: 750,
    art: "art-pepper",
    color: "#E76F51",
    waterNeed: "medium",
    marketStrength: "high",
    resilience: "low"
  },
  {
    nameEn: "Apples",
    nameAr: "تفاح",
    zoneFit: ["ajloun", "jerash", "irbid", "karak", "amman", "maan", "tafilah"],
    soilFit: ["loamy", "calcareous"],
    waterFit: ["rainfed", "well"],
    seasons: ["summer", "autumn"],
    avgYieldPerDunamKg: 1900,
    avgPriceJodPerKg: 0.8,
    avgCostPerDunamJod: 600,
    art: "art-apples",
    color: "#E63946",
    waterNeed: "high",
    marketStrength: "medium",
    resilience: "medium"
  },
  {
    nameEn: "Peaches",
    nameAr: "خوخ",
    zoneFit: ["ajloun", "jerash", "irbid", "karak", "balqa"],
    soilFit: ["loamy", "sandy"],
    waterFit: ["well", "rainfed"],
    seasons: ["summer"],
    avgYieldPerDunamKg: 1150,
    avgPriceJodPerKg: 0.9,
    avgCostPerDunamJod: 550,
    art: "art-peaches",
    color: "#F4A261",
    waterNeed: "medium",
    marketStrength: "medium",
    resilience: "medium"
  },
  {
    nameEn: "Cabbage",
    nameAr: "ملفوف",
    zoneFit: ["balqa", "irbid"],
    soilFit: ["clay", "loamy"],
    waterFit: ["well", "irrigation-network"],
    seasons: ["winter", "autumn"],
    avgYieldPerDunamKg: 4500,
    avgPriceJodPerKg: 0.25,
    avgCostPerDunamJod: 350,
    art: "art-cabbage",
    color: "#8AB17D",
    waterNeed: "medium",
    marketStrength: "medium",
    resilience: "high"
  },
  {
    nameEn: "Apricots",
    nameAr: "مشمش",
    zoneFit: ["mafraq", "jerash"],
    soilFit: ["sandy", "loamy"],
    waterFit: ["well", "rainfed"],
    seasons: ["spring", "summer"],
    avgYieldPerDunamKg: 1180,
    avgPriceJodPerKg: 1.2,
    avgCostPerDunamJod: 500,
    art: "art-apricots",
    color: "#F4A261",
    waterNeed: "medium",
    marketStrength: "medium",
    resilience: "medium"
  },
  {
    nameEn: "Carrots",
    nameAr: "جزر",
    zoneFit: ["jordan-valley", "amman"],
    soilFit: ["sandy", "loamy"],
    waterFit: ["irrigation-network", "well"],
    seasons: ["winter", "spring"],
    avgYieldPerDunamKg: 3450,
    avgPriceJodPerKg: 0.4,
    avgCostPerDunamJod: 400,
    art: "art-carrots",
    color: "#E76F51",
    waterNeed: "medium",
    marketStrength: "medium",
    resilience: "medium"
  },
  {
    nameEn: "Beans",
    nameAr: "فاصوليا",
    zoneFit: ["jordan-valley", "mafraq"],
    soilFit: ["loamy", "sandy"],
    waterFit: ["irrigation-network", "well"],
    seasons: ["summer", "spring"],
    avgYieldPerDunamKg: 2000,
    avgPriceJodPerKg: 0.8,
    avgCostPerDunamJod: 450,
    art: "art-beans",
    color: "#43A047",
    waterNeed: "medium",
    marketStrength: "high",
    resilience: "low"
  }
];

const marketUpdates = {
  Tomato: {
    trendEn: "Fast-moving vegetable demand, but margins tighten when irrigation costs climb.",
    trendAr: "الطلب على الخضار سريع الحركة، لكن الهوامش تضيق عندما ترتفع كلفة الري.",
    actionEn: "Sell in staggered batches and watch heat-driven supply swings.",
    actionAr: "قم بالبيع على دفعات وراقب تقلبات العرض الناتجة عن الحر."
  },
  Olive: {
    trendEn: "Steadier demand with stronger value in quality-focused orchard output.",
    trendAr: "الطلب أكثر استقرارًا مع قيمة أعلى للإنتاج البستاني الجيد.",
    actionEn: "Focus on quality grade and reduce unnecessary irrigation cycles.",
    actionAr: "ركز على جودة الإنتاج وقلل دورات الري غير الضرورية."
  },
  Wheat: {
    trendEn: "Lower price per kilo, but useful for lower-input and broader acreage planning.",
    trendAr: "السعر أقل لكل كيلو، لكنه مناسب للتخطيط واسع المساحة ومدخلات أقل.",
    actionEn: "Best when stability and lower water pressure matter more than premium pricing.",
    actionAr: "يناسب الحالات التي تكون فيها الاستقرارية وضغط المياه الأقل أهم من التسعير المرتفع."
  },
  Barley: {
    trendEn: "A practical resilience crop in drier conditions with modest but dependable returns.",
    trendAr: "محصول عملي للظروف الجافة بعائد متواضع لكنه أكثر ثباتًا.",
    actionEn: "Use as a conservative option when water pressure and risk are both high.",
    actionAr: "استخدمه كخيار محافظ عندما يكون ضغط المياه والمخاطر مرتفعين."
  },
  Pomegranate: {
    trendEn: "Good upside when fruit quality is protected and orchard timing is well managed.",
    trendAr: "يوفر فرصة جيدة عندما تتم حماية جودة الثمار وإدارة توقيت البستان جيدًا.",
    actionEn: "Protect fruit set and schedule irrigation carefully around stress periods.",
    actionAr: "احمِ عقد الثمار ونظّم الري بعناية حول فترات الإجهاد."
  },
  Zaatar: {
    trendEn: "Specialty demand remains attractive, especially for lower-water aromatic crops.",
    trendAr: "الطلب على المحاصيل المتخصصة ما يزال جيدًا، خصوصًا للمحاصيل العطرية الأقل استهلاكًا للماء.",
    actionEn: "Strong option when you want margin with more disciplined water use.",
    actionAr: "خيار قوي عندما تريد هامشًا جيدًا مع استخدام أكثر انضباطًا للمياه."
  }
  ,Dates: {
    trendEn: "Strong export demand, especially for Medjool varieties.",
    trendAr: "طلب تصدير قوي، خصوصاً لصنف المجهول.",
    actionEn: "Focus on fruit thinning and bagging to ensure premium sizing.",
    actionAr: "ركز على خف الثمار وتكييسها لضمان أحجام تصدير ممتازة."
  },
  Bananas: {
    trendEn: "Steady local demand, sensitive to import tariffs.",
    trendAr: "طلب محلي مستقر، يتأثر بتعرفة الاستيراد.",
    actionEn: "Optimize irrigation scheduling to prevent water stress.",
    actionAr: "حسن جدولة الري لمنع الإجهاد المائي."
  },
  Strawberries: {
    trendEn: "High margins for early winter greenhouse production.",
    trendAr: "هوامش ربح عالية للإنتاج الشتوي المبكر في البيوت البلاستيكية.",
    actionEn: "Protect from frost and maintain rigorous fungal control.",
    actionAr: "احمِ المحصول من الصقيع وحافظ على مكافحة فطرية صارمة."
  },
  Garlic: {
    trendEn: "Excellent storage crop with stable off-season prices.",
    trendAr: "محصول تخزيني ممتاز بأسعار مستقرة خارج الموسم.",
    actionEn: "Cure properly before storage to maximize shelf life.",
    actionAr: "جفف المحصول جيداً قبل التخزين لزيادة فترة الصلاحية."
  },
  Grapes: {
    trendEn: "Demand for table grapes is strong, but competition from imports can affect prices.",
    trendAr: "الطلب على عنب المائدة قوي، لكن المنافسة من المستوردات قد تؤثر على الأسعار.",
    actionEn: "Focus on quality and consider varieties that have a longer shelf life.",
    actionAr: "ركز على الجودة وفكر في الأصناف التي لها فترة صلاحية أطول."
  },
  Cucumber: {
    trendEn: "A staple in the local market with consistent demand, especially for greenhouse production.",
    trendAr: "عنصر أساسي في السوق المحلي بطلب ثابت، خاصة لإنتاج البيوت البلاستيكية.",
    actionEn: "Manage greenhouse climate carefully to optimize yield and reduce disease risk.",
    actionAr: "أدر مناخ البيوت البلاستيكية بعناية لتحسين الإنتاج وتقليل مخاطر الأمراض."
  },
  Potatoes: {
    trendEn: "High volume demand year-round, but prices are sensitive to storage and supply levels.",
    trendAr: "طلب بكميات كبيرة على مدار العام، لكن الأسعار حساسة لمستويات التخزين والعرض.",
    actionEn: "Plan your harvest and storage strategy to target optimal selling windows.",
    actionAr: "خطط لاستراتيجية الحصاد والتخزين لاستهداف نوافذ البيع المثلى."
  },
  Lentils: {
    trendEn: "A resilient, low-input crop with stable demand, often used in crop rotation.",
    trendAr: "محصول مرن ومنخفض المدخلات بطلب مستقر، وغالباً ما يستخدم في الدورة الزراعية.",
    actionEn: "A good choice for improving soil health while generating modest returns.",
    actionAr: "خيار جيد لتحسين صحة التربة مع تحقيق عوائد متواضعة."
  },
  Citrus: {
    trendEn: "Strong seasonal demand, heavily influenced by weather events during flowering.",
    trendAr: "طلب موسمي قوي، يتأثر بشدة بالظروف الجوية خلال فترة التزهير.",
    actionEn: "Maintain robust pest control and proper nutrition to ensure fruit quality.",
    actionAr: "حافظ على مكافحة فعالة للآفات وتغذية سليمة لضمان جودة الثمار."
  },
  Eggplant: {
    trendEn: "Consistent staple, but vulnerable to oversupply during peak harvest weeks.",
    trendAr: "منتج أساسي ثابت، لكنه عرضة لفائض العرض خلال أسابيع ذروة الحصاد.",
    actionEn: "Stagger planting dates if possible to avoid hitting the market all at once.",
    actionAr: "قم بجدولة تواريخ الزراعة على دفعات لتجنب إغراق السوق دفعة واحدة."
  },
  Watermelon: {
    trendEn: "Highly sensitive to summer heatwaves; early harvests capture the best premiums.",
    trendAr: "حساس جداً لموجات حر الصيف؛ الحصاد المبكر يحقق أفضل العوائد.",
    actionEn: "Prioritize rapid transport to market to maintain crispness and avoid spoilage.",
    actionAr: "أعطِ الأولوية للنقل السريع إلى السوق للحفاظ على الجودة وتجنب التلف."
  },
  Cauliflower: {
    trendEn: "Winter staple with reliable returns if head quality and color are maintained.",
    trendAr: "أساسي في الشتاء بعوائد موثوقة إذا تم الحفاظ على جودة الزهرة ولونها.",
    actionEn: "Protect heads from direct sunlight to prevent yellowing before harvest.",
    actionAr: "احمِ الزهرات من أشعة الشمس المباشرة لتجنب الاصفرار قبل الحصاد."
  },
  Figs: {
    trendEn: "High-value specialty crop with extremely short shelf life.",
    trendAr: "محصول متخصص عالي القيمة بفترة صلاحية قصيرة جداً.",
    actionEn: "Pre-arrange buyers and ensure daily harvesting to minimize loss.",
    actionAr: "رتب مع المشترين مسبقاً واحرص على الحصاد اليومي لتقليل الفاقد."
  },
  Almonds: {
    trendEn: "Excellent long-term investment, with green (early) almonds commanding high local prices.",
    trendAr: "استثمار ممتاز طويل الأجل، واللوز الأخضر (المبكر) يحظى بأسعار محلية عالية.",
    actionEn: "Evaluate early green harvest vs. dry nut harvest based on current market rates.",
    actionAr: "قيّم خيار الحصاد الأخضر المبكر مقابل الجاف بناءً على أسعار السوق الحالية."
  },
  Onions: {
    trendEn: "Excellent storage life allows growers to wait for optimal market conditions.",
    trendAr: "فترة التخزين الممتازة تتيح للمزارعين انتظار ظروف السوق المثلى.",
    actionEn: "Invest in proper curing and dry storage to maximize post-season profits.",
    actionAr: "استثمر في التجفيف السليم والتخزين الجاف لزيادة أرباح ما بعد الموسم."
  },
  Squash: {
    trendEn: "Fast-growing continuous harvest crop, but prices fluctuate daily.",
    trendAr: "محصول سريع النمو بحصاد مستمر، لكن الأسعار تتقلب يومياً.",
    actionEn: "Harvest frequently (often daily) to ensure optimal size for local consumer preference.",
    actionAr: "احصد بشكل متكرر لضمان الحجم المثالي المفضل لدى المستهلك المحلي."
  },
  Pepper: {
    trendEn: "Strong demand for both sweet and hot varieties, highly sensitive to pest pressures.",
    trendAr: "طلب قوي على الأصناف الحلوة والحارة، لكنه حساس لضغط الآفات.",
    actionEn: "Maintain strict greenhouse or field hygiene to prevent viral and fungal outbreaks.",
    actionAr: "حافظ على نظافة صارمة في الحقل أو البيت البلاستيكي لمنع تفشي الفيروسات والفطريات."
  },
  Apples: {
    trendEn: "Steady market, but relies heavily on cold storage availability and quality sizing.",
    trendAr: "سوق مستقر، لكنه يعتمد بشكل كبير على توفر التبريد وأحجام الثمار الجيدة.",
    actionEn: "Practice aggressive thinning early in the season to ensure larger, premium fruit.",
    actionAr: "مارس الخف المكثف في بداية الموسم لضمان ثمار أكبر وأعلى جودة."
  },
  Peaches: {
    trendEn: "Highly perishable summer favorite; timing and cold chain are critical.",
    trendAr: "فاكهة صيفية مفضلة سريعة التلف؛ التوقيت وسلسلة التبريد حاسمان.",
    actionEn: "Handle with extreme care during picking and packaging to prevent bruising.",
    actionAr: "تعامل بحذر شديد أثناء القطاف والتعبئة لتجنب الكدمات."
  },
  Cabbage: {
    trendEn: "Heavy, bulk crop that provides reliable winter income with low relative maintenance.",
    trendAr: "محصول شتوي ثقيل يوفر دخلاً موثوقاً مع متطلبات صيانة منخفضة نسبياً.",
    actionEn: "Monitor for caterpillars and ensure consistent moisture to prevent head splitting.",
    actionAr: "راقب اليرقات واضمن رطوبة منتظمة لمنع تشقق الرؤوس."
  },
  Apricots: {
    trendEn: "Very short harvest window; prices are highest at the absolute beginning of the season.",
    trendAr: "نافذة حصاد قصيرة جداً؛ الأسعار تكون في ذروتها في بداية الموسم تماماً.",
    actionEn: "Mobilize harvest labor quickly; delay can result in overripe fruit and lost value.",
    actionAr: "حشد عمال الحصاد بسرعة؛ التأخير يؤدي لثمار ناضجة أكثر من اللازم وفقدان القيمة."
  },
  Carrots: {
    trendEn: "Stable market, but physical appearance (straightness) dictates grading and price.",
    trendAr: "سوق مستقر، لكن المظهر الخارجي (الاستقامة) يحدد التصنيف والسعر.",
    actionEn: "Ensure deep, loose soil preparation before planting to avoid forked roots.",
    actionAr: "تأكد من تحضير تربة عميقة ومفككة قبل الزراعة لتجنب تفرع الجذور."
  },
  Beans: {
    trendEn: "Green beans have excellent local demand but are highly sensitive to heat stress.",
    trendAr: "الفاصوليا الخضراء تحظى بطلب محلي ممتاز لكنها حساسة جداً للإجهاد الحراري.",
    actionEn: "Provide adequate irrigation during flowering and pod fill to prevent yield drop.",
    actionAr: "وفر رياً كافياً خلال فترة التزهير وامتلاء القرون لمنع انخفاض الإنتاج."
  }
};

// Sample historical price data for the ARIMA model (e.g., JOD per Kg over the last 10 periods)
const marketData = [
  { id: "tomato", nameEn: "Tomato", nameAr: "طماطم", history: [0.20, 0.22, 0.21, 0.24, 0.23, 0.25, 0.27, 0.26, 0.28, 0.29] },
  { id: "potatoes", nameEn: "Potatoes", nameAr: "بطاطا", history: [0.38, 0.39, 0.41, 0.40, 0.42, 0.41, 0.43, 0.44, 0.42, 0.45] },
  { id: "grapes", nameEn: "Grapes", nameAr: "عنب", history: [0.75, 0.78, 0.77, 0.80, 0.82, 0.81, 0.85, 0.84, 0.86, 0.88] },
  { id: "olive", nameEn: "Olive", nameAr: "زيتون", history: [1.60, 1.65, 1.62, 1.70, 1.68, 1.72, 1.75, 1.74, 1.80, 1.82] },
  { id: "wheat", nameEn: "Wheat", nameAr: "قمح", history: [0.28, 0.28, 0.29, 0.29, 0.30, 0.30, 0.31, 0.30, 0.31, 0.32] },
  { id: "citrus", nameEn: "Citrus", nameAr: "حمضيات", history: [0.55, 0.58, 0.60, 0.59, 0.62, 0.65, 0.63, 0.61, 0.64, 0.66] },
  { id: "eggplant", nameEn: "Eggplant", nameAr: "باذنجان", history: [0.35, 0.36, 0.34, 0.38, 0.40, 0.39, 0.42, 0.41, 0.45, 0.44] },
  { id: "watermelon", nameEn: "Watermelon", nameAr: "بطيخ", history: [0.22, 0.23, 0.25, 0.24, 0.26, 0.25, 0.28, 0.27, 0.30, 0.29] },
  { id: "cauliflower", nameEn: "Cauliflower", nameAr: "قرنبيط", history: [0.38, 0.40, 0.39, 0.42, 0.41, 0.44, 0.43, 0.46, 0.45, 0.48] },
  { id: "figs", nameEn: "Figs", nameAr: "تين", history: [1.40, 1.45, 1.42, 1.50, 1.48, 1.55, 1.52, 1.60, 1.58, 1.65] },
  { id: "almonds", nameEn: "Almonds", nameAr: "لوز", history: [3.20, 3.30, 3.25, 3.40, 3.35, 3.50, 3.45, 3.60, 3.55, 3.70] },
  { id: "onions", nameEn: "Onions", nameAr: "بصل", history: [0.30, 0.32, 0.31, 0.34, 0.33, 0.36, 0.35, 0.38, 0.37, 0.40] },
  { id: "squash", nameEn: "Squash", nameAr: "كوسا", history: [0.45, 0.48, 0.46, 0.50, 0.49, 0.52, 0.51, 0.55, 0.54, 0.58] },
  { id: "pepper", nameEn: "Pepper", nameAr: "فلفل", history: [0.55, 0.58, 0.56, 0.60, 0.59, 0.62, 0.61, 0.65, 0.64, 0.68] },
  { id: "apples", nameEn: "Apples", nameAr: "تفاح", history: [0.75, 0.78, 0.76, 0.80, 0.79, 0.82, 0.81, 0.85, 0.84, 0.88] },
  { id: "peaches", nameEn: "Peaches", nameAr: "خوخ", history: [0.85, 0.88, 0.86, 0.90, 0.89, 0.92, 0.91, 0.95, 0.94, 0.98] },
  { id: "cabbage", nameEn: "Cabbage", nameAr: "ملفوف", history: [0.22, 0.24, 0.23, 0.26, 0.25, 0.28, 0.27, 0.30, 0.29, 0.32] },
  { id: "apricots", nameEn: "Apricots", nameAr: "مشمش", history: [1.10, 1.15, 1.12, 1.20, 1.18, 1.25, 1.22, 1.30, 1.28, 1.35] },
  { id: "carrots", nameEn: "Carrots", nameAr: "جزر", history: [0.35, 0.38, 0.36, 0.40, 0.39, 0.42, 0.41, 0.45, 0.44, 0.48] },
  { id: "beans", nameEn: "Beans", nameAr: "فاصوليا", history: [0.75, 0.78, 0.76, 0.80, 0.79, 0.82, 0.81, 0.85, 0.84, 0.88] }
];

function applyLanguage(lang) {
  const rtl = lang === "ar";
  document.documentElement.lang = lang;
  document.documentElement.dir = rtl ? "rtl" : "ltr";
  localStorage.setItem("ardiLang", lang);

  document.querySelectorAll("[data-en][data-ar]").forEach(node => {
    const content = lang === "ar" ? node.dataset.ar : node.dataset.en;
    if (node.tagName === "OPTION") {
      node.textContent = content;
    } else {
      node.innerHTML = content;
    }
  });

  document.querySelectorAll("option[data-en][data-ar]").forEach(node => {
    node.textContent = lang === "ar" ? node.dataset.ar : node.dataset.en;
  });

  document.querySelectorAll("input[data-en][data-ar], textarea[data-en][data-ar]").forEach(node => {
    node.placeholder = lang === "ar" ? node.dataset.ar : node.dataset.en;
  });

  document.querySelectorAll(".lang-btn, .lang-btn-top").forEach(btn => {
    btn.textContent = lang === "ar" ? "EN" : "AR";
  });

  const menuToggle = document.getElementById("menuToggle");
  if (menuToggle) menuToggle.textContent = lang === "ar" ? "القائمة" : "Menu";
}

function setupLanguageToggle() {
  applyLanguage(localStorage.getItem("ardiLang") || "ar");
  document.querySelectorAll(".lang-btn, .lang-btn-top").forEach(btn => {
    btn.addEventListener("click", () => {
      const newLang = document.documentElement.lang === "ar" ? "en" : "ar";
      applyLanguage(newLang);
      if (document.getElementById("currentTemp")) setupWeather();
      if (document.getElementById("marketTrendsGrid")) setupMarketTrends();
      if (window.allMoaDocs && document.getElementById("moaReportsGrid")) window.renderMoaReports(window.allMoaDocs);
      
      // Update Authentication Button text based on language
      const user = auth.currentUser;
      document.querySelectorAll('.auth-btn').forEach(b => {
         b.textContent = user ? (newLang === 'ar' ? 'حسابي' : 'Account') : (newLang === 'ar' ? 'دخول' : 'Login');
      });

      // Retrigger the active telemetry button to update localized text correctly
      const activeTelBtn = document.querySelector(".tel-btn.active");
      if (activeTelBtn) activeTelBtn.click();
      
      const telSelect = document.getElementById("tel-zone-select");
      if (telSelect) telSelect.dispatchEvent(new Event('change'));
    });
  });
}

function setupMenu() {
  const sidebar = document.getElementById("sidebar");
  const burger = document.getElementById("menuToggle");
  const overlay = document.getElementById("overlay");
  if (!sidebar) return;

  function openMenu() {
    sidebar.classList.add("open");
    if (overlay) overlay.classList.add("show");
    document.body.style.overflow = "hidden";
  }

  function closeMenu() {
    sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("show");
    document.body.style.overflow = "";
  }

  if (burger) {
    burger.addEventListener("click", () => {
      sidebar.classList.contains("open") ? closeMenu() : openMenu();
    });
  }
  if (overlay) overlay.addEventListener("click", closeMenu);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu();
  });
  sidebar.querySelectorAll(".nav-item, .nav-link").forEach(link => {
    link.addEventListener("click", closeMenu);
  });
}

function setupPageTransitions() {
  document.body.style.opacity = "0";
  document.body.style.transition = "opacity 0.22s ease";
  requestAnimationFrame(() => {
    document.body.style.opacity = "1";
  });

  document.querySelectorAll("a.nav-item, a.nav-link, a.btn[href$='.html'], a.poster-card[href$='.html'], a.module-card[href$='.html']").forEach(link => {
    link.addEventListener("click", event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      event.preventDefault();
      document.body.style.opacity = "0";
      setTimeout(() => {
        window.location.href = href;
      }, 220);
    });
  });
}

function computeScore(crop, input) {
  let score = 0;
  if (crop.zoneFit.includes(input.zone)) score += 40;
  if (crop.soilFit.includes(input.soil)) score += 25;
  if (crop.waterFit.includes(input.water)) score += 20;
  if (crop.seasons.includes(input.season)) score += 15;

  if (input.decisionFocus === "profit") {
    if (crop.avgPriceJodPerKg >= 1.5) score += 12;
    if (crop.avgCostPerDunamJod <= 250) score += 6;
  }

  if (input.decisionFocus === "resilience") {
    if (crop.resilience === "high") score += 14;
    if (crop.resilience === "medium") score += 6;
    if (crop.waterNeed === "high") score -= 8;
    if (input.water === "rainfed" && crop.waterNeed === "high") score -= 8;
  }

  if (input.decisionFocus === "market") {
    if (crop.marketStrength === "high") score += 14;
    if (crop.marketStrength === "medium") score += 7;
  }

  return score;
}

function estimateEconomics(cropData, plotSize) {
  const expectedProduction = cropData.avgYieldPerDunamKg * plotSize;
  const estimatedRevenue = expectedProduction * cropData.avgPriceJodPerKg;
  const estimatedCost = cropData.avgCostPerDunamJod * plotSize;
  return {
    expectedProduction,
    estimatedRevenue,
    estimatedCost,
    estimatedProfit: estimatedRevenue - estimatedCost
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-JO", {
    style: "currency",
    currency: "JOD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-JO", {
    maximumFractionDigits: 0
  }).format(value);
}

function getDecisionMessage(crop, lang, focus) {
  if (focus === "profit") {
    return lang === "ar"
      ? "تمت ترقية هذا المحصول لأن الربحية والفرصة الاقتصادية أخذتا وزنًا أكبر في القرار."
      : "This crop was boosted because profit potential carried more weight in the recommendation.";
  }
  if (focus === "resilience") {
    return lang === "ar"
      ? "تمت ترقية هذا المحصول لأنه أكثر استقرارًا في التشغيل وأخف ضغطًا على الموارد في الظروف المتقلبة."
      : "This crop was boosted because it offers a steadier, lower-risk operating profile.";
  }
  if (focus === "market") {
    return lang === "ar"
      ? "تمت ترقية هذا المحصول لأن حركة السوق والطلب السريع كانا جزءًا أساسيًا من القرار."
      : "This crop was boosted because market momentum and selling opportunity were prioritized.";
  }
  return lang === "ar"
    ? "التوصية هنا متوازنة بين الملاءمة الزراعية والتكلفة والفرصة السوقية."
    : "This recommendation balances field fit, cost pressure, and market opportunity.";
}

function getRecommendationTimeline(crop, lang, mode) {
  const timelineAr = {
    low: [
      { label: "قبل الزراعة", note: "جهّز التربة واحتفظ بالرطوبة الأولية بدون ري مفرط." },
      { label: "الأسابيع الأولى", note: "اعتمد دفعات ري خفيفة ومراقبة منتظمة بدل كميات كبيرة." },
      { label: "منتصف الموسم", note: "استمر بالري عند الحاجة فقط وراقب النبات لتجنب الهدر." },
      { label: "البيع", note: "استفد من ميزة انخفاض استهلاك المياه في تحسين الكلفة النهائية." }
    ],
    medium: [
      { label: "قبل الزراعة", note: "خطط لمصدر المياه مسبقًا وحدد جدولًا واضحًا للري." },
      { label: "بداية النمو", note: "حافظ على ري منتظم دون إغراق، خصوصًا في الفترات الحساسة." },
      { label: "الإنتاج", note: "ركز على انتظام المياه لأن التذبذب قد يؤثر على الجودة." },
      { label: "السوق", note: "تابع الجودة والتوقيت لأن القيمة تتحسن مع إدارة جيدة للمحصول." }
    ],
    high: [
      { label: "قبل الزراعة", note: "لا تبدأ إلا مع خطة ري واضحة ومصدر ماء موثوق." },
      { label: "بداية الموسم", note: "يحتاج المحصول متابعة لصيقة حتى لا ترتفع تكلفة المياه سريعًا." },
      { label: "ذروة النمو", note: "استخدم الري في الأوقات المناسبة وتجنب الفاقد الحراري قدر الإمكان." },
      { label: "التسويق", note: "راقب السوق جيدًا لأن الربحية تتأثر مباشرة بكلفة المياه." }
    ]
  };

  const timelineEn = {
    low: [
      { label: "Before planting", note: "Prepare the soil and preserve starting moisture without heavy irrigation." },
      { label: "Early weeks", note: "Use lighter irrigation cycles and monitoring instead of large water pushes." },
      { label: "Mid-season", note: "Irrigate on need, not habit, to avoid waste." },
      { label: "Selling window", note: "Lower water pressure can help protect final margins." }
    ],
    medium: [
      { label: "Before planting", note: "Plan the water source early and define a tighter irrigation routine." },
      { label: "Early growth", note: "Keep irrigation regular without overwatering during sensitive stages." },
      { label: "Production stage", note: "Consistency matters because uneven watering can affect quality." },
      { label: "Market timing", note: "Quality and timing improve the return for this crop." }
    ],
    high: [
      { label: "Before planting", note: "Start only with a clear irrigation plan and reliable water supply." },
      { label: "Early season", note: "This crop needs close follow-up so water costs do not climb too fast." },
      { label: "Peak growth", note: "Use better timing to reduce heat-related irrigation loss." },
      { label: "Selling window", note: "Margins are sensitive to water cost, so market timing matters." }
    ]
  };

  const base = lang === "ar" ? timelineAr[crop.waterNeed] : timelineEn[crop.waterNeed];
  if (mode !== "resilience") return base;

  return base.map((step, index) => ({
    label: step.label,
    note: index === 1
      ? (lang === "ar"
        ? `${step.note} مع هامش أمان أعلى في التنفيذ والمتابعة.`
        : `${step.note} with a stronger emphasis on resilience and steadier execution.`)
      : step.note
  }));
}

function setupAdvisorForm() {
  const form = document.getElementById("advisorForm");
  const result = document.getElementById("resultPanel");
  if (!form || !result) return;
  
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const liveCropStats = window.globalLiveCropStats || [];

    const input = {
      zone: document.getElementById("zone").value,
      soil: document.getElementById("soil").value,
      water: document.getElementById("water").value,
      season: document.getElementById("season").value,
      plotSize: Number(document.getElementById("plotSize").value),
      decisionFocus: document.getElementById("decisionFocus").value,
      cropCategory: document.getElementById("cropCategory")?.value || "any"
    };

    const lang = document.documentElement.lang === "ar" ? "ar" : "en";
    
    // 1. Show AI Loading State
    result.classList.remove("empty");
    result.innerHTML = `
      <div style="text-align:center; padding: 4rem 1rem;">
        <div style="width:48px; height:48px; border:4px solid rgba(255,255,255,0.1); border-top-color: var(--wheat); border-radius:50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
        <h3 style="color: var(--wheat-soft); margin-top: 1.5rem; font-family: var(--font-serif);">${lang === 'ar' ? 'مشمش يحلل بيانات الحقل...' : 'Mishmish is analyzing field data...'}</h3>
        <p style="color: rgba(255,255,255,0.6); font-size: 0.85rem; margin-top: 0.5rem;">${lang === 'ar' ? 'نستخدم الذكاء الاصطناعي لاختيار المحصول الأنسب وابتكار خطة مخصصة.' : 'Using AI to match crops and generate a tailored plan.'}</p>
      </div>
    `;
    if (!document.getElementById('spin-style')) {
      const style = document.createElement('style');
      style.id = 'spin-style';
      style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
      document.head.appendChild(style);
    }

    try {
      // 2. Call Gemini API
      const prompt = `You are Ardi, an expert AI agronomist for Jordan.
Field Profile:
- Zone: ${input.zone}
- Soil: ${input.soil}
- Water: ${input.water}
- Season: ${input.season}
- Priority: ${input.decisionFocus}
- Category Filter: ${input.cropCategory === 'any' ? 'Any Category' : input.cropCategory}

Crop Database:
${JSON.stringify(cropDatabase.map(c => ({ name: c.nameEn, category: c.category, zone: c.zoneFit, soil: c.soilFit, water: c.waterFit, season: c.seasons, resilience: c.resilience, marketStrength: c.marketStrength })))}

Task:
1. Select the absolute best crop from the database for this profile. If a Category Filter is active (not 'Any Category'), you MUST ONLY pick from crops matching that category.
2. Select 3 alternative crops from the database (also strictly matching the category filter if active).
3. Generate insightful, highly specific, and practical advice for the top crop based entirely on the field profile provided.

Language for output text: ${lang === "ar" ? "Arabic" : "English"}.

Return ONLY a JSON object matching this schema:
{
  "topCropNameEn": "Exact English name of top crop from database",
  "alternativesEn": ["Alt 1", "Alt 2", "Alt 3"],
  "decisionLens": "2-sentence explanation of why the top crop perfectly fits this specific field profile",
  "timeline": [
    { "label": "Phase 1", "note": "Actionable advice" },
    { "label": "Phase 2", "note": "..." },
    { "label": "Phase 3", "note": "..." },
    { "label": "Phase 4", "note": "..." }
  ],
  "marketTrend": "1-sentence realistic market trend for the top crop in Jordan",
  "marketAction": "1-sentence strategic action for maximizing profit/yield"
}`;

      // Call Gemini API directly from the frontend
      const geminiApiKey = "AIzaSyAjSrM5jd6Vev2RhgXA4PIgt72isWC271E";
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
      const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json" }
          })
      });
      const json = await response.json();
      if (!json.candidates || json.candidates.length === 0) throw new Error("No response from Gemini");
      const aiResult = JSON.parse(json.candidates[0].content.parts[0].text);

      // 3. Match AI output to local DB for economics math
      let topBaseCrop = cropDatabase.find(c => c.nameEn.toLowerCase() === aiResult.topCropNameEn.toLowerCase());
      if (!topBaseCrop) topBaseCrop = cropDatabase[0]; // fallback safety

      const relevantStat = liveCropStats
        .filter(s => s.cropNameEn === topBaseCrop.nameEn && s.region === input.zone)
        .sort((a, b) => (b.year || 0) - (a.year || 0))[0];

      const topCropData = { ...topBaseCrop, ...relevantStat };
      const topEco = estimateEconomics(topCropData, input.plotSize);

      const altCrops = aiResult.alternativesEn.map(name => {
        const c = cropDatabase.find(x => x.nameEn.toLowerCase() === name.toLowerCase());
        return c || cropDatabase[1];
      }).slice(0, 3);

      const topName = lang === "ar" ? topCropData.nameAr : topCropData.nameEn;
      const profit = topEco.estimatedProfit;
      const profitColor = profit >= 0 ? "#43A047" : "#E76F51";
      
      const modeLabel = input.decisionFocus === "profit"
        ? (lang === "ar" ? "التركيز: الربحية" : "Focus: Profit")
        : input.decisionFocus === "resilience"
          ? (lang === "ar" ? "التركيز: الاستقرار" : "Focus: Resilience")
          : input.decisionFocus === "market"
            ? (lang === "ar" ? "التركيز: السوق" : "Focus: Market")
            : (lang === "ar" ? "التركيز: التوازن" : "Focus: Balanced");

      const liveDataNotice = !!relevantStat 
        ? `<div style="font-size:0.65rem; text-align:center; color: var(--wheat-soft); opacity: 0.8; margin-top: 0.5rem;" data-en="Economic data based on MoA report for ${topCropData.year}" data-ar="البيانات الاقتصادية مبنية على تقرير الوزارة لعام ${topCropData.year}">${lang === 'ar' ? `البيانات الاقتصادية مبنية على تقرير الوزارة لعام ${topCropData.year}` : `Economic data based on MoA report for ${topCropData.year}`}</div>`
        : `<div style="font-size:0.65rem; text-align:center; color: rgba(255,255,255,0.5); margin-top: 0.5rem;" data-en="Using general estimates" data-ar="باستخدام تقديرات عامة">${lang === 'ar' ? 'باستخدام تقديرات عامة' : 'Using general estimates'}</div>`;

      // 4. Render AI UI
      result.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div class="result-eyebrow">${lang === "ar" ? "توصية الذكاء الاصطناعي" : "AI Recommendation"}</div>
          <div style="font-size: 0.7rem; background: rgba(255,255,255,0.1); padding: 0.2rem 0.6rem; border-radius: 99px; color: var(--wheat-soft); font-weight: bold;">✨ Powered by Gemini</div>
        </div>
        <div class="result-crop">${topName}</div>
        <div class="result-mode">${modeLabel}</div>
        <div class="result-score-bar">
          <div class="result-score-fill" style="width:100%; background: linear-gradient(90deg, #A5D6A7, var(--wheat-soft));"></div>
        </div>
        <p style="font-size:0.76rem;color:rgba(255,255,255,0.5);margin-bottom:1rem">
          ${lang === "ar" ? "تم التحليل والتطابق بنجاح" : "Analysis & Match Complete"}
        </p>
        <div class="result-stat-row">
          <div class="result-stat">
            <div class="result-stat-label">${lang === "ar" ? "الإنتاج المتوقع" : "Expected Yield"}</div>
            <div class="result-stat-value">${formatNumber(topEco.expectedProduction)} kg</div>
          </div>
          <div class="result-stat">
            <div class="result-stat-label">${lang === "ar" ? "الإيراد" : "Revenue"}</div>
            <div class="result-stat-value">${formatCurrency(topEco.estimatedRevenue)}</div>
          </div>
          <div class="result-stat">
            <div class="result-stat-label">${lang === "ar" ? "التكلفة" : "Cost"}</div>
            <div class="result-stat-value">${formatCurrency(topEco.estimatedCost)}</div>
          </div>
          <div class="result-stat">
            <div class="result-stat-label">${lang === "ar" ? "صافي الربح" : "Net Profit"}</div>
            <div class="result-stat-value" style="color:${profitColor}">${formatCurrency(profit)}</div>
          </div>
          ${liveDataNotice}
        </div>
        <p style="font-size:0.7rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:0.5rem">
          ${lang === "ar" ? "محاصيل بديلة مقترحة" : "Suggested Alternatives"}
        </p>
        <ul class="alt-list">
          ${altCrops.map(item => `
            <li>
              <span>${lang === "ar" ? item.nameAr : item.nameEn}</span>
              <span class="alt-score">★ AI Pick</span>
            </li>
          `).join("")}
        </ul>
        <div class="result-section">
          <div class="result-section-title">${lang === "ar" ? "منطق القرار (AI)" : "AI Decision Lens"}</div>
          <div class="result-note">${aiResult.decisionLens}</div>
        </div>
        <div class="result-section">
          <div class="result-section-title">${lang === "ar" ? "خطة العمل المخصصة" : "Tailored Action Plan"}</div>
          <div class="result-timeline">
            ${aiResult.timeline.map((step, index) => `
              <div class="result-timeline-item">
                <div class="result-timeline-step">${index + 1}</div>
                <div class="result-timeline-copy">
                  <strong>${step.label}</strong>
                  <span>${step.note}</span>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
        <div class="result-section">
          <div class="result-section-title">${lang === "ar" ? "رؤية السوق" : "Market Insights"}</div>
          <div class="result-note">${aiResult.marketTrend}</div>
          <div class="result-note result-note-soft">${aiResult.marketAction}</div>
        </div>
      `;
      observeScrollElements(result);

    } catch (error) {
      console.error("AI Recommendation failed, falling back to static engine:", error);
      
      let dbToUse = cropDatabase;
      if (input.cropCategory !== "any") {
        dbToUse = cropDatabase.filter(c => c.category === input.cropCategory);
        if (dbToUse.length === 0) dbToUse = cropDatabase; // safety fallback
      }

      // FALLBACK: Execute original static logic if Gemini API hits a rate limit or fails
      const ranked = dbToUse.map(baseCrop => {
          const relevantStat = liveCropStats
            .filter(s => s.cropNameEn === baseCrop.nameEn && s.region === input.zone)
            .sort((a, b) => (b.year || 0) - (a.year || 0))[0];

          const finalCropData = { ...baseCrop, ...relevantStat };

          return {
            crop: finalCropData,
            score: computeScore(finalCropData, input),
            eco: estimateEconomics(finalCropData, input.plotSize),
            isLiveData: !!relevantStat
          };
        })
        .sort((a, b) => b.score - a.score);

      const top = ranked[0];
      const alternatives = ranked.slice(1, 4);
      const topName = lang === "ar" ? top.crop.nameAr : top.crop.nameEn;
      const profit = top.eco.estimatedProfit;
      const profitColor = profit >= 0 ? "#43A047" : "#E76F51";
      const timeline = getRecommendationTimeline(top.crop, lang, input.decisionFocus);
      const market = marketUpdates[top.crop.nameEn];
      const modeLabel = input.decisionFocus === "profit"
        ? (lang === "ar" ? "التركيز: الربحية" : "Focus: Profit")
        : input.decisionFocus === "resilience"
          ? (lang === "ar" ? "التركيز: الاستقرار" : "Focus: Resilience")
          : input.decisionFocus === "market"
            ? (lang === "ar" ? "التركيز: السوق" : "Focus: Market")
            : (lang === "ar" ? "التركيز: التوازن" : "Focus: Balanced");
            
      const liveDataNotice = top.isLiveData 
        ? `<div style="font-size:0.65rem; text-align:center; color: var(--wheat-soft); opacity: 0.8; margin-top: 0.5rem;" data-en="Economic data based on MoA report for ${top.crop.year}" data-ar="البيانات الاقتصادية مبنية على تقرير الوزارة لعام ${top.crop.year}">البيانات الاقتصادية مبنية على تقرير الوزارة لعام ${top.crop.year}</div>`
        : `<div style="font-size:0.65rem; text-align:center; color: rgba(255,255,255,0.5); margin-top: 0.5rem;" data-en="Using general estimates" data-ar="باستخدام تقديرات عامة">باستخدام تقديرات عامة</div>`;

      result.innerHTML = `
        <div class="result-eyebrow">${lang === "ar" ? "أفضل توصية" : "Top Recommendation"}</div>
        <div class="result-crop">${topName}</div>
        <div class="result-mode">${modeLabel}</div>
        <div class="result-score-bar">
          <div class="result-score-fill" style="width:${Math.max(0, Math.min(top.score, 100))}%"></div>
        </div>
        <p style="font-size:0.76rem;color:rgba(255,255,255,0.5);margin-bottom:1rem">
          ${lang === "ar" ? "درجة التوافق" : "Compatibility"}: ${top.score}/100
        </p>
        <div class="result-stat-row">
          <div class="result-stat">
            <div class="result-stat-label">${lang === "ar" ? "الإنتاج المتوقع" : "Expected Yield"}</div>
            <div class="result-stat-value">${formatNumber(top.eco.expectedProduction)} kg</div>
          </div>
          <div class="result-stat">
            <div class="result-stat-label">${lang === "ar" ? "الإيراد" : "Revenue"}</div>
            <div class="result-stat-value">${formatCurrency(top.eco.estimatedRevenue)}</div>
          </div>
          <div class="result-stat">
            <div class="result-stat-label">${lang === "ar" ? "التكلفة" : "Cost"}</div>
            <div class="result-stat-value">${formatCurrency(top.eco.estimatedCost)}</div>
          </div>
          <div class="result-stat">
            <div class="result-stat-label">${lang === "ar" ? "صافي الربح" : "Net Profit"}</div>
            <div class="result-stat-value" style="color:${profitColor}">${formatCurrency(profit)}</div>
          </div>
          ${liveDataNotice}
        </div>
        <p style="font-size:0.7rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:0.5rem">
          ${lang === "ar" ? "محاصيل بديلة" : "Alternatives"}
        </p>
        <ul class="alt-list">
          ${alternatives.map(item => `
            <li>
              <span>${lang === "ar" ? item.crop.nameAr : item.crop.nameEn}</span>
              <span class="alt-score">${item.score}/100</span>
            </li>
          `).join("")}
        </ul>
        <div class="result-section">
          <div class="result-section-title">${lang === "ar" ? "منطق القرار" : "Decision lens"}</div>
          <div class="result-note">${getDecisionMessage(top.crop, lang, input.decisionFocus)}</div>
        </div>
        <div class="result-section">
          <div class="result-section-title">${lang === "ar" ? "خط زمني للتوصية" : "Recommendation timeline"}</div>
          <div class="result-timeline">
            ${timeline.map((step, index) => `
              <div class="result-timeline-item">
                <div class="result-timeline-step">${index + 1}</div>
                <div class="result-timeline-copy">
                  <strong>${step.label}</strong>
                  <span>${step.note}</span>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
        <div class="result-section">
          <div class="result-section-title">${lang === "ar" ? "تحديثات السوق" : "Market updates"}</div>
          <div class="result-note">${lang === "ar" ? market.trendAr : market.trendEn}</div>
          <div class="result-note result-note-soft">${lang === "ar" ? market.actionAr : market.actionEn}</div>
        </div>
      `;
      observeScrollElements(result);
    }
  });
}

function setupMyPlots() {
  const addBtn = document.getElementById("addPlotBtn");
  const form = document.getElementById("addPlotForm");
  const list = document.getElementById("plotList");
  const saveBtn = document.getElementById("savePlotBtn");
  const emptyMsg = document.getElementById("emptyMsg");
  if (!list) return;

  window.renderPlots = function(plotsArr) {
    if (!currentUser) {
      const lang = document.documentElement.lang || 'ar';
      const text = lang === 'ar' ? 'الرجاء تسجيل الدخول لعرض الأراضي.' : 'Please log in to view plots.';
      list.innerHTML = `<p style="color:var(--muted);padding:1rem 0" data-en="Please log in to view plots." data-ar="الرجاء تسجيل الدخول لعرض الأراضي.">${text}</p>`;
      if (emptyMsg) emptyMsg.style.display = "none";
      return;
    }

    if (plotsArr.length === 0) {
      list.innerHTML = "";
      if (emptyMsg) emptyMsg.style.display = "";
      return;
    }
    if (emptyMsg) emptyMsg.style.display = "none";

    list.innerHTML = plotsArr.map((plot) => `
      <div class="plot-card">
          <div class="plot-marker">◆</div>
        <div style="flex:1">
          <div class="plot-name">${plot.name}</div>
          <div class="plot-meta">
            <span class="plot-pill">${plot.zone}</span>
            <span class="plot-pill">${plot.size} dunam</span>
            <span class="plot-pill">${plot.soil}</span>
            <span class="plot-pill">${plot.water}</span>
          </div>
        </div>
        <button onclick="deletePlot('${plot.id}')" style="background:none;border:none;cursor:pointer;color:#7A6E5A;font-size:1.1rem;padding:4px">✕</button>
      </div>
    `).join("");
    observeScrollElements(list);
  };

  window.deletePlot = async function(id) {
    if (!currentUser) return;
    await deleteDoc(doc(db, "users", currentUser.uid, "plots", id));
  };

  if (addBtn && form) {
    addBtn.addEventListener("click", () => {
      if (!currentUser) { 
        const lang = document.documentElement.lang || 'ar';
        alert(lang === 'ar' ? 'الرجاء تسجيل الدخول أولاً.' : 'Please log in first.'); 
        return; 
      }
      form.style.display = form.style.display === "none" ? "block" : "none";
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      if (!currentUser) return;
      const name = document.getElementById("plotName")?.value?.trim();
      const zone = document.getElementById("plotZone")?.value;
      const size = document.getElementById("plotSize2")?.value;
      const soil = document.getElementById("plotSoil")?.value;
      const water = document.getElementById("plotWater")?.value;

      if (!name || !zone || !size || !soil || !water) {
        alert("Please fill all fields.");
        return;
      }

      await addDoc(collection(db, "users", currentUser.uid, "plots"), {
        name, zone, size, soil, water, createdAt: serverTimestamp()
      });

      if (form) form.style.display = "none";
      document.getElementById("plotName").value = "";
    });
  }

  window.renderPlots([]); // Load initial state
}

function setupJournal() {
  const addBtn = document.getElementById("addEntryBtn");
  const form = document.getElementById("entryForm");
  const saveBtn = document.getElementById("saveEntryBtn");
  const list = document.getElementById("journalList");
  if (!list) return;

  const tagIcons = {
    Watering: "○",
    Fertilizer: "△",
    "Pest Control": "□",
    Harvest: "◇",
    Maintenance: "☆"
  };

  window.renderJournal = function(entriesArr) {
    if (!currentUser) {
      const lang = document.documentElement.lang || 'ar';
      const text = lang === 'ar' ? 'الرجاء تسجيل الدخول لعرض السجل.' : 'Please log in to view your journal.';
      list.innerHTML = `<p style="color:var(--muted);padding:1rem 0" data-en="Please log in to view your journal." data-ar="الرجاء تسجيل الدخول لعرض السجل.">${text}</p>`;
      return;
    }

    if (entriesArr.length === 0) {
      list.innerHTML = `<p style="color:var(--muted);font-style:italic;padding:1rem 0">No journal entries yet. Add your first field activity.</p>`;
      return;
    }

    // Data is ordered descending from Firestore, so no need to .reverse()
    list.innerHTML = `<div class="timeline">${entriesArr.map(entry => `
      <div class="timeline-item">
        <div class="timeline-dot ${entry.type === "Harvest" ? "wheat" : entry.type === "Watering" ? "olive" : "clay"}">${tagIcons[entry.type] || "◆"}</div>
        <div class="timeline-body">
          <div class="timeline-date" style="display:flex; justify-content:space-between; align-items:center;">
            <span>${entry.date}</span>
            <button onclick="deleteJournalEntry('${entry.id}')" title="Delete entry" style="background:none;border:none;cursor:pointer;color:#E76F51;font-size:1rem;padding:0;line-height:1;opacity:0.8;">✕</button>
          </div>
          <div class="timeline-entry">
            <div class="timeline-entry-title">${entry.type} — ${entry.plot || "General"}</div>
            <div class="timeline-entry-note">${entry.note || "—"}</div>
          </div>
        </div>
      </div>
    `).join("")}</div>`;
    observeScrollElements(list);
  };

  window.deleteJournalEntry = async function(id) {
    if (!currentUser) return;
    await deleteDoc(doc(db, "users", currentUser.uid, "journal", id));
  };

  if (addBtn && form) {
    addBtn.addEventListener("click", () => {
      if (!currentUser) { 
        const lang = document.documentElement.lang || 'ar';
        alert(lang === 'ar' ? 'الرجاء تسجيل الدخول أولاً.' : 'Please log in first.'); 
        return; 
      }
      form.style.display = form.style.display === "none" ? "block" : "none";
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      if (!currentUser) return;
      const type = document.getElementById("entryType")?.value;
      const plot = document.getElementById("entryPlot")?.value?.trim();
      const note = document.getElementById("entryNote")?.value?.trim();
      const date = new Date().toLocaleDateString("en-JO", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });

      if (!type) {
        alert("Select an activity type.");
        return;
      }

      await addDoc(collection(db, "users", currentUser.uid, "journal"), {
        type, plot, note, date, createdAt: serverTimestamp()
      });

      if (form) form.style.display = "none";
      document.getElementById("entryNote").value = "";
    });
  }

  window.renderJournal([]); // Load initial state
}

function generateAIWeatherInsights(weatherData, lang, container) {
  const temp = weatherData.current.temp_c;
  const wind = weatherData.current.wind_kph;
  const conditionText = weatherData.current.condition.text.toLowerCase();
  const isRainy = conditionText.includes("rain") || conditionText.includes("مطر") || weatherData.current.precip_mm > 0;

  let insightsEn = [];
  let insightsAr = [];

  // Temperature Rules
  if (temp >= 35) {
    insightsEn.push("<strong>🌡️ Heat Stress Warning:</strong> Extreme temperatures detected. Delay planting new seedlings to avoid transplant shock. Increase irrigation frequency for established crops.");
    insightsAr.push("<strong>🌡️ تحذير إجهاد حراري:</strong> درجات حرارة شديدة. يُنصح بتأجيل زراعة الشتلات الجديدة لتجنب صدمة النقل. قم بزيادة وتيرة الري للمحاصيل القائمة.");
  } else if (temp <= 10) {
    insightsEn.push("<strong>❄️ Cold Temp Alert:</strong> Cold temperatures present. Postpone sowing warm-season seeds. Protect sensitive crops from potential frost.");
    insightsAr.push("<strong>❄️ تنبيه برودة:</strong> درجات حرارة منخفضة. أجّل زراعة بذور المحاصيل الصيفية. احمِ المحاصيل الحساسة من احتمالية الصقيع.");
  } else {
    insightsEn.push("<strong>🌱 Optimal Growing Window:</strong> Current temperatures are within the optimal range for most field activities, sowing, and transplanting.");
    insightsAr.push("<strong>🌱 نافذة نمو مثالية:</strong> درجات الحرارة الحالية ضمن النطاق المثالي لمعظم الأنشطة الحقلية، نثر البذور، ونقل الشتلات.");
  }

  // Wind Rules
  if (wind >= 25) {
    insightsEn.push("<strong>💨 High Wind Hazard:</strong> Halt all foliar spraying and pesticide applications to prevent drift. Secure loose row covers and delicate structures.");
    insightsAr.push("<strong>💨 خطر رياح نشطة:</strong> أوقف جميع عمليات الرش الورقي والمبيدات لتجنب الانجراف. ثبت الأغطية البلاستيكية والهياكل الحساسة جيداً.");
  }

  // Rain Rules
  if (isRainy) {
    insightsEn.push("<strong>🌧️ Precipitation Detected:</strong> Suspend irrigation to prevent soil waterlogging. Excellent window for broadcasting cover crop seeds.");
    insightsAr.push("<strong>🌧️ هطول أمطار:</strong> أوقف الري لتجنب غمر التربة. فرصة ممتازة لنثر بذور المحاصيل الغطائية.");
  } else if (temp > 15 && temp < 35 && wind < 15) {
    insightsEn.push("<strong>☀️ Clear Field Conditions:</strong> Favorable conditions for foliar feeding, pruning, and general field maintenance.");
    insightsAr.push("<strong>☀️ ظروف حقلية مستقرة:</strong> ظروف مواتية للرش الورقي، التقليم، والصيانة العامة للحقل.");
  }

  const finalEn = insightsEn.join("<br><br>");
  const finalAr = insightsAr.join("<br><br>");
  
  container.innerHTML = lang === "ar" ? finalAr : finalEn;
  container.setAttribute("data-en", finalEn);
  container.setAttribute("data-ar", finalAr);
}

function setupWeather() {
  const currentTemp = document.getElementById("currentTemp");
  if (!currentTemp) return; // Only run on weather page

  const currentDesc = document.getElementById("currentDesc");
  const currentHumidity = document.getElementById("currentHumidity");
  const currentWind = document.getElementById("currentWind");
  const currentRain = document.getElementById("currentRain");
  const currentHigh = document.getElementById("currentHigh");
  const forecastGrid = document.getElementById("forecastGrid");
  const weatherBig = document.querySelector(".weather-big");
  const currentIcon = document.getElementById("currentIcon");

  const lang = document.documentElement.lang; // 'ar' or 'en'

  currentDesc.textContent = lang === "ar" ? "جاري التحميل..." : "Loading...";

  const weatherApiKey = "2a3292b2875544f5a90110401262004";
  const weatherUrl = `https://api.weatherapi.com/v1/forecast.json?key=${weatherApiKey}&q=Amman&days=4&lang=${lang}`;
  
  fetch(weatherUrl)
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        console.error("API Error:", data.error.message);
        currentDesc.textContent = lang === "ar" ? "الرجاء إضافة مفتاح API" : "Please add API key";
        return;
      }

      // Populate Current Conditions
      currentTemp.textContent = Math.round(data.current.temp_c) + "C";
      currentHumidity.textContent = data.current.humidity + "%";
      currentWind.textContent = Math.round(data.current.wind_kph) + " km/h";
      currentRain.textContent = data.current.precip_mm + " mm";
      currentHigh.textContent = Math.round(data.forecast.forecastday[0].day.maxtemp_c) + "C";

      // Use the native Arabic/English string straight from the API
      currentDesc.textContent = data.current.condition.text;
      currentDesc.removeAttribute("data-en");
      currentDesc.removeAttribute("data-ar");

      // Add Weather Icon
      if (currentIcon) {
        currentIcon.src = "https:" + data.current.condition.icon;
        currentIcon.style.display = "block";
      }

      // Apple-Style Dynamic Backgrounds
      if (weatherBig) {
        const isDay = data.current.is_day;
        const conditionText = data.current.condition.text.toLowerCase();
        let gradient = "linear-gradient(135deg, #4A90E2 0%, #003366 100%)"; // Default Day
        
        if (!isDay) {
          gradient = "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)"; // Night sky
        } else if (conditionText.includes("rain") || conditionText.includes("مطر") || conditionText.includes("drizzle") || conditionText.includes("زخات")) {
          gradient = "linear-gradient(135deg, #4b6cb7 0%, #182848 100%)"; // Rain/Storm
        } else if (conditionText.includes("cloud") || conditionText.includes("غائم") || conditionText.includes("overcast")) {
          gradient = "linear-gradient(135deg, #606c88 0%, #3f4c6b 100%)"; // Cloudy
        } else if (conditionText.includes("clear") || conditionText.includes("sunny") || conditionText.includes("صافي") || conditionText.includes("مشمس")) {
          gradient = "linear-gradient(135deg, #2980B9 0%, #6DD5FA 100%)"; // Sunny clear sky
        }
        
        weatherBig.style.backgroundImage = gradient;
        weatherBig.style.color = "#ffffff";
      }

      const daysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const daysAr = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      const colors = ["wheat", "olive", "clay", "dark"];
      let forecastHtml = "";

      // Loop dynamically based on API limit (Free tier returns up to 3 days max)
      for (let i = 1; i < data.forecast.forecastday.length; i++) {
        const dayData = data.forecast.forecastday[i];
        const date = new Date(dayData.date);
        const dayIndex = date.getDay();
        const tempMax = Math.round(dayData.day.maxtemp_c);

        forecastHtml += `
          <div class="metric-card">
            <div class="metric-value ${colors[i - 1]}">${tempMax}</div>
            <div class="metric-label">${lang === "ar" ? daysAr[dayIndex] : daysEn[dayIndex]}</div>
          </div>
        `;
      }
      forecastGrid.innerHTML = forecastHtml;
      observeScrollElements(forecastGrid);

      // Trigger AI Insights
      const aiCard = document.getElementById("aiInsightsCard");
      const aiContent = document.getElementById("aiInsightsContent");
      if (aiCard && aiContent) {
        aiCard.style.display = "block";
        generateAIWeatherInsights(data, lang, aiContent);
      }
    })
    .catch(err => console.error("Weather fetch failed", err));
}

// --- ARIMA & SPARKLINE LOGIC ---

function computeARIMA(history, steps) {
  // Simplified ARIMA(1,1,0) implementation
  // 1. Differencing (d=1) to make the data stationary
  const diff = [];
  for (let i = 1; i < history.length; i++) {
    diff.push(history[i] - history[i - 1]);
  }

  // 2. AutoRegressive AR(1) calculation using least squares
  let sumProducts = 0;
  let sumSquares = 0;
  for (let i = 1; i < diff.length; i++) {
    sumProducts += diff[i] * diff[i - 1];
    sumSquares += diff[i - 1] * diff[i - 1];
  }
  const phi = sumSquares === 0 ? 0 : sumProducts / sumSquares;

  // 3. Forecast and Integrate (reverse the differencing)
  const forecast = [];
  let lastVal = history[history.length - 1];
  let lastDiff = diff[diff.length - 1];

  for (let i = 0; i < steps; i++) {
    let nextDiff = phi * lastDiff;
    let nextVal = lastVal + nextDiff;
    forecast.push(nextVal);
    lastDiff = nextDiff;
    lastVal = nextVal;
  }
  return forecast;
}

function renderSparkline(canvasId, history, forecast) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const padding = 5;

  const fullData = [...history, ...forecast];
  const min = Math.min(...fullData);
  const max = Math.max(...fullData);
  const range = max - min || 1;

  const stepX = (width - padding * 2) / (fullData.length - 1);
  const scaleY = (height - padding * 2) / range;

  function drawPaths() {
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";

    // Draw Historical Data (Solid Line)
    ctx.beginPath();
    ctx.strokeStyle = "#43A047"; // green
    for (let i = 0; i < history.length; i++) {
      const x = padding + i * stepX;
      const y = height - padding - (history[i] - min) * scaleY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw Forecast Data (Dashed Line)
    ctx.beginPath();
    ctx.strokeStyle = "#E76F51"; // terracotta
    ctx.setLineDash([5, 5]); 
    const histLastX = padding + (history.length - 1) * stepX;
    const histLastY = height - padding - (history[history.length - 1] - min) * scaleY;
    ctx.moveTo(histLastX, histLastY);

    for (let i = 0; i < forecast.length; i++) {
      const x = padding + (history.length + i) * stepX;
      const y = height - padding - (forecast[i] - min) * scaleY;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]); // reset dashes
  }

  let startTime = null;
  const duration = 1200; // Animation duration in milliseconds

  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3); // Cubic ease-out for a smooth slowdown at the end

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width * ease, height); // Expanding clipping box
    ctx.clip();
    
    drawPaths();
    
    ctx.restore();

    if (progress < 1) requestAnimationFrame(animate);
  }
  
  requestAnimationFrame(animate);
}

async function setupMarketTrends() {
  const select = document.getElementById("arimaCropSelect");
  const singleView = document.getElementById("arimaSingleView");
  if (!select || !singleView) return;

  const lang = document.documentElement.lang;

  let fetchedMarketData = [];
  try {
    const snapshot = await getDocs(collection(db, "market_prices"));
    snapshot.forEach(doc => {
        const d = doc.data();
        // Ensure it has a valid historical array from Firestore
        if (d.history && Array.isArray(d.history) && d.history.length > 2) {
            fetchedMarketData.push({ id: doc.id, nameEn: d.nameEn || doc.id, nameAr: d.nameAr || doc.id, history: d.history });
        }
    });
  } catch (err) {
    console.error("Could not load market trends from DB:", err);
  }

  const activeData = fetchedMarketData.length > 0 ? fetchedMarketData : marketData;

  // Populate select dropdown
  select.innerHTML = activeData.map((item, index) =>
    `<option value="${index}">${lang === "ar" ? item.nameAr : item.nameEn}</option>`
  ).join('');

  function renderSelectedARIMA() {
    const index = select.value;
    const item = activeData[index];
    if (!item) return;

    const forecast = computeARIMA(item.history, 5);
    const currentPrice = item.history[item.history.length - 1];
    const forecastedPrice = forecast[forecast.length - 1];
    const trend = forecastedPrice > currentPrice ? "↑" : forecastedPrice < currentPrice ? "↓" : "—";
    const trendColor = forecastedPrice > currentPrice ? "var(--success)" : "var(--danger)";

    singleView.innerHTML = `
      <div class="card" style="max-width: 700px;">
        <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <h3 class="card-title" style="margin: 0;">${lang === "ar" ? item.nameAr : item.nameEn}</h3>
          <span style="color: ${trendColor}; font-weight: bold; font-size: 1.4rem;">${trend} ${forecastedPrice.toFixed(2)} JOD</span>
        </div>
        <p style="margin: 0 0 1.5rem; font-size: 0.85rem; color: var(--muted);">
          ${lang === "ar" ? "توقع لـ 5 فترات قادمة (بناءً على أسعار سوق عمان المركزي)" : "5-period lookahead (Amman Central Market)"}
        </p>
        <canvas id="sparkline-single" width="700" height="180" style="width: 100%; height: 180px; display: block;"></canvas>
        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); margin-top: 1rem;">
          <span>${lang === "ar" ? "سجل تاريخي" : "Historical"}</span>
          <span style="color: var(--wheat);">${lang === "ar" ? "توقع ARIMA" : "ARIMA Forecast"}</span>
        </div>
      </div>
    `;
    observeScrollElements(singleView);
    renderSparkline(`sparkline-single`, item.history, forecast);
  }

  select.addEventListener("change", renderSelectedARIMA);
  renderSelectedARIMA(); // Initial render
}

const scrollObserver = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-revealed");
      obs.unobserve(entry.target);
    }
  });
}, { rootMargin: "0px 0px -30px 0px", threshold: 0.05 });

function observeScrollElements(root = document) {
  if (!root) return;
  const elements = root.querySelectorAll(
    '.surface-panel, .result-panel, .card, .feature-card, .poster-card, .pairing-card, .weather-big, .plot-card, .section-title, .timeline-item, .metric-card, .result-timeline-item'
  );
  elements.forEach((el, index) => {
    if (!el.classList.contains('reveal-on-scroll')) {
      el.classList.add('reveal-on-scroll');
      el.style.transitionDelay = `${(index % 4) * 0.08}s`; // Creates the cascading stagger effect
      scrollObserver.observe(el);
    }
  });
}

function setupSeasonalCalendar() {
  const form = document.getElementById("calendarForm");
  const result = document.getElementById("calendarResult");
  const cropSelect = document.getElementById("calCrop");
  if (!form || !result || !cropSelect) return;

  const lang = document.documentElement.lang || "ar";
  
  // Pre-fill crop dropdown
  cropSelect.innerHTML = cropDatabase.map(c => 
    `<option value="${c.nameEn}" data-en="${c.nameEn}" data-ar="${c.nameAr}">${lang === 'ar' ? c.nameAr : c.nameEn}</option>`
  ).join('');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const cropName = cropSelect.value;
    const month = document.getElementById("calMonth").value;
    const activeLang = document.documentElement.lang === "ar" ? "Arabic" : "English";

    result.classList.remove("empty");
    result.innerHTML = `
      <div style="text-align:center; padding: 3rem 1rem;">
        <div style="width:48px; height:48px; border:4px solid rgba(255,255,255,0.1); border-top-color: var(--wheat); border-radius:50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
        <h3 style="color: var(--wheat-soft); margin-top: 1rem; font-family: var(--font-serif);">${activeLang === 'Arabic' ? 'مشمش يخطط للموسم...' : 'Mishmish is scheduling the season...'}</h3>
      </div>
    `;

    try {
      const prompt = `You are Ardi, an expert AI agronomist in Jordan. Create a highly practical, month-by-month seasonal farming calendar for planting ${cropName} starting in ${month}.
      Language: ${activeLang}.
      Return ONLY a JSON object matching this exact schema:
      {
        "overview": "2-sentence summary of the timeline",
        "timeline": [ { "timeframe": "e.g., Month 1 - Preparation", "action": "Specific task" } ] // exactly 4 to 5 steps
      }`;

      const geminiApiKey = "AIzaSyAjSrM5jd6Vev2RhgXA4PIgt72isWC271E";
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
      const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json" }
          })
      });
      const json = await response.json();
      if (!json.candidates || json.candidates.length === 0) throw new Error("No response from Gemini");
      const aiResult = JSON.parse(json.candidates[0].content.parts[0].text);

      const cropTitle = activeLang === 'Arabic' ? cropDatabase.find(c => c.nameEn === cropName).nameAr : cropName;
      
      result.innerHTML = `
        <div class="result-eyebrow">${activeLang === 'Arabic' ? 'خطة التنفيذ' : 'Execution Plan'} - ${cropTitle}</div>
        <div class="result-note" style="margin-top: 0.8rem;">${aiResult.overview}</div>
        <div class="result-timeline" style="margin-top: 1.5rem;">
          ${aiResult.timeline.map((step, i) => `<div class="result-timeline-item"><div class="result-timeline-step ${i === aiResult.timeline.length - 1 ? 'wheat' : 'olive'}" style="color:${i === aiResult.timeline.length - 1 ? 'var(--ink)' : '#fff'}">${i + 1}</div><div class="result-timeline-copy"><strong>${step.timeframe}</strong><span>${step.action}</span></div></div>`).join("")}
        </div>
      `;
      observeScrollElements(result);
    } catch (err) {
      console.error(err);
      result.innerHTML = `<div style="text-align:center; color:#E76F51; padding: 2rem;">Error generating calendar.</div>`;
    }
  });
}

function setupInteractiveWidgets() {
  // 1. Regional Telemetry Interaction
  const telSelect = document.getElementById("tel-zone-select");
  const moistBar = document.getElementById("tel-moist-bar");
  const moistVal = document.getElementById("tel-moist-val");
  const nitBar = document.getElementById("tel-nit-bar");
  const nitVal = document.getElementById("tel-nit-val");
  const sunBar = document.getElementById("tel-sun-bar");
  const sunVal = document.getElementById("tel-sun-val");

  const telData = {
    "amman": { mBar: "45%", mVal: "45%", nBar: "60%", nVal: "Medium", sBar: "75%", sVal: "9h" },
    "zarqa": { mBar: "30%", mVal: "30%", nBar: "50%", nVal: "Medium", sBar: "85%", sVal: "10h" },
    "irbid": { mBar: "65%", mVal: "65%", nBar: "85%", nVal: "High", sBar: "60%", sVal: "6h" },
    "mafraq": { mBar: "25%", mVal: "25%", nBar: "40%", nVal: "Low", sBar: "95%", sVal: "11h" },
    "ajloun": { mBar: "75%", mVal: "75%", nBar: "80%", nVal: "High", sBar: "55%", sVal: "6h" },
    "jerash": { mBar: "60%", mVal: "60%", nBar: "70%", nVal: "High", sBar: "65%", sVal: "7h" },
    "balqa": { mBar: "55%", mVal: "55%", nBar: "65%", nVal: "Medium", sBar: "70%", sVal: "8h" },
    "madaba": { mBar: "40%", mVal: "40%", nBar: "55%", nVal: "Medium", sBar: "80%", sVal: "9h" },
    "karak": { mBar: "35%", mVal: "35%", nBar: "45%", nVal: "Low", sBar: "85%", sVal: "10h" },
    "tafilah": { mBar: "30%", mVal: "30%", nBar: "40%", nVal: "Low", sBar: "85%", sVal: "10h" },
    "maan": { mBar: "20%", mVal: "20%", nBar: "35%", nVal: "Low", sBar: "90%", sVal: "11h" },
    "aqaba": { mBar: "15%", mVal: "15%", nBar: "30%", nVal: "Low", sBar: "95%", sVal: "12h" },
    "jordan-valley": { mBar: "50%", mVal: "50%", nBar: "75%", nVal: "High", sBar: "90%", sVal: "10h" }
  };

  if (telSelect) {
    telSelect.addEventListener("change", () => {
      const zone = telSelect.value;
      const data = telData[zone];
      if (!data) return;
      
      if (moistBar) {
        moistBar.style.width = data.mBar;
        moistVal.textContent = data.mVal;
        nitBar.style.width = data.nBar;
        
        const lang = document.documentElement.lang;
        let nvEn = data.nVal;
        let nvAr = nvEn === "Low" ? "منخفض" : nvEn === "Medium" ? "متوسط" : "مرتفع";
        
        nitVal.dataset.en = nvEn;
        nitVal.dataset.ar = nvAr;
        nitVal.textContent = lang === "ar" ? nvAr : nvEn;
        
        sunBar.style.width = data.sBar;
        sunVal.textContent = data.sVal;
      }
    });
  }

  // 2. Quick Yield Estimator Interaction
  const cropSelect = document.getElementById("roi-crop");
  const zoneSelect = document.getElementById("roi-zone");
  const areaSlider = document.getElementById("roi-area");
  const areaVal = document.getElementById("roi-area-val");
  const revDisplay = document.getElementById("roi-revenue");
  const costDisplay = document.getElementById("roi-cost");
  const yieldDisplay = document.getElementById("roi-yield");

  function animateCounter(element, targetValue, duration, formatter, suffix = "") {
    if (element.animationId) cancelAnimationFrame(element.animationId);
    
    let startTime = null;
    
    function updateCounter(timestamp) {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // Cubic ease-out for a smooth deceleration
      const currentValue = targetValue * ease;

      element.textContent = formatter(currentValue) + suffix;

      if (progress < 1) {
        element.animationId = requestAnimationFrame(updateCounter);
      } else {
        element.textContent = formatter(targetValue) + suffix;
      }
    }
    
    element.animationId = requestAnimationFrame(updateCounter);
  }

  if (cropSelect) {
    const lang = document.documentElement.lang || "ar";
    cropSelect.innerHTML = cropDatabase.map(c => 
      `<option value="${c.nameEn}" data-en="${c.nameEn}" data-ar="${c.nameAr}">${lang === 'ar' ? c.nameAr : c.nameEn}</option>`
    ).join('');
  }

  window.updateEstimatorFn = function() {
    if (!cropSelect || !areaSlider || !zoneSelect) return;
    const cropName = cropSelect.value;
    const zoneName = zoneSelect.value;
    const area = Number(areaSlider.value);
    areaVal.textContent = area + " D";

    const baseCrop = cropDatabase.find(c => c.nameEn === cropName);
    if (baseCrop) {
      // Cross-reference with live Firestore data for that specific zone
      const relevantStat = (window.globalLiveCropStats || [])
        .filter(s => s.cropNameEn === baseCrop.nameEn && s.region === zoneName)
        .sort((a, b) => (b.year || 0) - (a.year || 0))[0];
        
      const finalCrop = { ...baseCrop, ...relevantStat };
      const eco = estimateEconomics(finalCrop, area);

      animateCounter(revDisplay, eco.estimatedRevenue, 800, formatCurrency, "");
      animateCounter(costDisplay, eco.estimatedCost, 800, formatCurrency, "");
      animateCounter(yieldDisplay, eco.expectedProduction, 800, formatNumber, " kg");
    }
  };

  window.triggerZoneAutoSelect = function() {
    if (!zoneSelect || !cropSelect) return;
    const zoneName = zoneSelect.value;
    const liveCropStats = window.globalLiveCropStats || [];
    
    let bestCrop = null;
    let maxProfit = -Infinity;

    // Find the most profitable crop suitable for the newly selected zone
    cropDatabase.forEach(baseCrop => {
      if (baseCrop.zoneFit.includes(zoneName)) {
        const relevantStat = liveCropStats
          .filter(s => s.cropNameEn === baseCrop.nameEn && s.region === zoneName)
          .sort((a, b) => (b.year || 0) - (a.year || 0))[0];
        const finalCrop = { ...baseCrop, ...relevantStat };
        const eco = estimateEconomics(finalCrop, 1); // Use 1 dunam as baseline comparison
        if (eco.estimatedProfit > maxProfit) {
          maxProfit = eco.estimatedProfit;
          bestCrop = finalCrop;
        }
      }
    });

    if (bestCrop) cropSelect.value = bestCrop.nameEn;
    if (window.updateEstimatorFn) window.updateEstimatorFn();
  };

  if (cropSelect) cropSelect.addEventListener("change", window.updateEstimatorFn);
  if (zoneSelect) zoneSelect.addEventListener("change", window.triggerZoneAutoSelect);
  if (areaSlider) areaSlider.addEventListener("input", window.updateEstimatorFn);
  
  if (window.triggerZoneAutoSelect) window.triggerZoneAutoSelect(); // Run once on load
}

function setupFloralParallax() {
  const shell = document.querySelector('.site-shell');
  if (!shell) return;
  
  document.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 35; // Maximum 35px shift
    const y = (e.clientY / window.innerHeight - 0.5) * 35;
    
    shell.style.setProperty('--mouse-x', `${x}px`);
    shell.style.setProperty('--mouse-y', `${y}px`);
  });
}

function setupChatbot() {
  const html = `
    <div class="chatbot-container">
      <button id="chatbotToggle" class="chatbot-toggle">
        <img src="https://images.vexels.com/media/users/3/158109/isolated/preview/45554e769cf0539a21eb324928745d5b-plant-branch-icon.png" alt="Chat" style="width: 28px; height: 28px; filter: brightness(0) invert(1);" />
      </button>
      <div id="chatbotWindow" class="chatbot-window">
        <div class="chatbot-header">
          <span data-en="Mishmish" data-ar="مشمش">مشمش</span>
          <button id="chatbotClose" class="chatbot-close">✕</button>
        </div>
        <div id="chatbotMessages" class="chatbot-messages"></div>
        <div class="chatbot-input-area">
          <input type="text" id="chatbotInput" class="chatbot-input" data-en="Ask me anything..." data-ar="اسألني أي شيء..." placeholder="اسألني أي شيء..." />
          <button id="chatbotSend" class="chatbot-send" data-en="Send" data-ar="إرسال">إرسال</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);

  const toggle = document.getElementById("chatbotToggle");
  const chatWindow = document.getElementById("chatbotWindow");
  const closeBtn = document.getElementById("chatbotClose");
  const messages = document.getElementById("chatbotMessages");
  const input = document.getElementById("chatbotInput");
  const sendBtn = document.getElementById("chatbotSend");

  let isOpen = false;

  function addMessage(textEn, textAr, sender) {
    const lang = document.documentElement.lang || "ar";
    const text = lang === 'ar' ? textAr : textEn;
    const msgDiv = document.createElement("div");
    msgDiv.className = `chat-msg ${sender}`;
    msgDiv.setAttribute("data-en", textEn);
    msgDiv.setAttribute("data-ar", textAr);
    msgDiv.innerHTML = text;
    messages.appendChild(msgDiv);
    messages.scrollTop = messages.scrollHeight;
  }

  // Initial greeting
  addMessage(
    "Hello! I am Mishmish, your Ardi assistant. How can I help you navigate today?",
    "مرحباً! أنا مشمش، مساعد أرضي. كيف يمكنني مساعدتك اليوم في تصفح الموقع؟",
    "bot"
  );

  function handleSend() {
    const val = input.value.trim().toLowerCase();
    if (!val) return;
    
    const userVal = input.value.trim();
    addMessage(userVal, userVal, "user");
    input.value = "";

    setTimeout(() => {
      if (val.includes("weather") || val.includes("طقس") || val.includes("جو") || val.includes("مناخ")) {
        addMessage(
          "You can check live weather conditions and AI insights on the <a href='weather.html' style='text-decoration:underline; font-weight:bold;'>Weather page</a>.",
          "يمكنك التحقق من حالة الطقس الحية وتحليلات الذكاء الاصطناعي في <a href='weather.html' style='text-decoration:underline; font-weight:bold;'>صفحة الطقس</a>.",
          "bot"
        );
      } else if (val.includes("advisor") || val.includes("crop") || val.includes("مستشار") || val.includes("محاصيل")) {
        addMessage(
          "The Crop Advisor helps you pick the best crop for your field. <a href='crop-advisor.html' style='text-decoration:underline; font-weight:bold;'>Go to Crop Advisor</a>.",
          "يساعدك مستشار المحاصيل في اختيار أفضل محصول لأرضك. <a href='crop-advisor.html' style='text-decoration:underline; font-weight:bold;'>اذهب إلى مستشار المحاصيل</a>.",
          "bot"
        );
      } else if (val.includes("plot") || val.includes("أرض") || val.includes("حقل") || val.includes("اراضي")) {
        addMessage(
          "Manage your fields and farm data in the <a href='my-plots.html' style='text-decoration:underline; font-weight:bold;'>My Plots section</a>.",
          "قم بإدارة حقولك وبيانات مزرعتك في <a href='my-plots.html' style='text-decoration:underline; font-weight:bold;'>قسم أراضيّ</a>.",
          "bot"
        );
      } else if (val.includes("journal") || val.includes("سجل") || val.includes("يوميات") || val.includes("مذكرات")) {
        addMessage(
          "Track activities like watering, fertilizing, and harvesting in the <a href='plot-journal.html' style='text-decoration:underline; font-weight:bold;'>Plot Journal</a>.",
          "تتبع الأنشطة مثل الري والتسميد والحصاد في <a href='plot-journal.html' style='text-decoration:underline; font-weight:bold;'>سجل الحقل</a>.",
          "bot"
        );
      } else if (val.includes("companion") || val.includes("مرافق") || val.includes("نبات") || val.includes("زراعة")) {
        addMessage(
          "Discover natural crop pairings to improve resilience in the <a href='companion-plants.html' style='text-decoration:underline; font-weight:bold;'>Companion Plants page</a>.",
          "اكتشف الأزواج الزراعية الطبيعية لتحسين مرونة الحقل في <a href='companion-plants.html' style='text-decoration:underline; font-weight:bold;'>صفحة النباتات المرافقة</a>.",
          "bot"
        );
      } else {
        addMessage(
          "I'm here to help you navigate. You can ask me about 'Weather', 'Crop Advisor', 'My Plots', 'Journal', or 'Companions'.",
          "أنا هنا لمساعدتك. يمكنك سؤالي عن 'الطقس'، 'مستشار المحاصيل'، 'أراضيّ'، 'السجل'، أو 'النباتات المرافقة'.",
          "bot"
        );
      }
    }, 500);
  }

  toggle.addEventListener("click", () => {
    isOpen = !isOpen;
    if (isOpen) {
      chatWindow.classList.add("open");
      input.focus();
    } else {
      chatWindow.classList.remove("open");
    }
  });

  closeBtn.addEventListener("click", () => {
    isOpen = false;
    chatWindow.classList.remove("open");
  });

  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSend();
  });
}

async function setupMarketTicker() {
  // Prevent duplicate tickers if this function is ever called more than once.
  if (document.querySelector('.market-ticker')) {
    return;
  }

  // 1. Define CSS with direction-aware animations for a seamless loop in both AR and EN
  const tickerCss = `
    .market-ticker {
      background: linear-gradient(135deg, #d32f2f, #b71c1c);
      color: #fff;
      padding: 0.35rem 0;
      overflow: hidden;
      white-space: nowrap;
      font-size: 0.75rem;
      border-bottom: 1px solid rgba(0,0,0,0.1);
      cursor: default;
      user-select: none;
    }
    .ticker-wrap {
      display: flex;
      width: max-content;
    }
    html[dir="ltr"] .ticker-wrap {
      animation: ticker-scroll-ltr 240s linear infinite;
    }
    html[dir="rtl"] .ticker-wrap {
      animation: ticker-scroll-rtl 240s linear infinite;
    }
    .market-ticker:hover .ticker-wrap {
      animation-play-state: paused;
    }
    .ticker-track {
      display: flex;
      flex-shrink: 0;
    }
    .ticker-item {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0 1.5rem;
    }
    .ticker-item .crop-name {
      font-weight: 600;
      opacity: 0.9;
    }
    .ticker-item .crop-price {
      font-weight: 700;
    }
    .ticker-item .separator {
      color: rgba(255, 255, 255, 0.4);
    }
    @keyframes ticker-scroll-ltr {
      0% { transform: translate3d(0, 0, 0); }
      100% { transform: translate3d(-50%, 0, 0); }
    }
    @keyframes ticker-scroll-rtl {
      0% { transform: translate3d(0, 0, 0); }
      100% { transform: translate3d(50%, 0, 0); }
    }
  `;

  // 2. Inject CSS into the head if it doesn't exist
  if (!document.getElementById('market-ticker-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'market-ticker-styles';
    styleEl.innerHTML = tickerCss;
    document.head.appendChild(styleEl);
  }

  // 3. Fetch live market prices from Firestore
  let livePrices = {};
  try {
    const snapshot = await getDocs(collection(db, "market_prices"));
    snapshot.forEach(doc => {
      // Store by document ID (e.g., "tomato")
      livePrices[doc.id.toLowerCase()] = doc.data(); 
    });
  } catch (err) {
    console.error("Could not fetch live market prices:", err);
  }

  // 4. Create ticker content. We duplicate the items enough times so it 
  // never runs out of text on wide screens, creating a perfect infinite loop.
  const prefix = lang === 'ar' ? 'سوق عمان المركزي | ' : 'Amman Central Market | ';
  const lang = document.documentElement.lang || 'ar';
  const baseItemsHtml = cropDatabase.map(crop => {
    const currentName = lang === 'ar' ? crop.nameAr : crop.nameEn;
    
    // Attempt to find live data for this crop
    const cropKey = crop.nameEn.toLowerCase();
    const liveData = livePrices[cropKey];
    
    // If live data exists use it, otherwise fallback to the hardcoded average
    const price = liveData && liveData.price !== undefined ? parseFloat(liveData.price).toFixed(2) : crop.avgPriceJodPerKg.toFixed(2);
    
    // Add a trend arrow and color if live data provides a trend ("up", "down")
    let trendIcon = '';
    let priceColor = 'var(--wheat-soft)'; // default soft yellow/white color for red background
    
    if (liveData && liveData.trend === 'up') {
      trendIcon = ' <span style="color: #A5D6A7; font-size: 0.9em;">↑</span>'; // Light green
      priceColor = '#A5D6A7';
    } else if (liveData && liveData.trend === 'down') {
      trendIcon = ' <span style="color: #FFCDD2; font-size: 0.9em;">↓</span>'; // Light pink/red
      priceColor = '#FFCDD2';
    }
    
    return `
      <div class="ticker-item">
        <span class="crop-name" data-en="${prefix}${crop.nameEn}" data-ar="${prefix}${crop.nameAr}">${prefix}${currentName}</span>
        <span class="crop-price" style="color: ${priceColor}">${price} JOD/kg${trendIcon}</span>
        <span class="separator">◆</span>
      </div>
    `;
  }).join('');

  const singleTrackHtml = baseItemsHtml.repeat(6); // 6 repetitions per track guarantees it overflows the screen

  // 5. Create the full ticker HTML structure with two identical giant tracks
  const tickerHtml = `
    <div class="market-ticker" aria-hidden="true">
      <div class="ticker-wrap">
        <div class="ticker-track">${singleTrackHtml}</div>
        <div class="ticker-track">${singleTrackHtml}</div>
      </div>
    </div>
  `;

  // 6. Inject the ticker into the DOM.
  const header = document.querySelector('header.site-header') || document.querySelector('header');
  const siteShell = document.querySelector('.site-shell');

  if (header) {
    header.insertAdjacentHTML('afterend', tickerHtml);
  } else if (siteShell) {
    siteShell.insertAdjacentHTML('afterbegin', tickerHtml);
  } else {
    document.body.insertAdjacentHTML('afterbegin', tickerHtml);
  }
}

async function setupMoaReports() {
  const container = document.getElementById("moaReportsGrid");
  const searchInput = document.getElementById("moaSearch");
  if (!container) return;

  const lang = document.documentElement.lang || 'ar';
  container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 3rem; color: var(--muted);">${lang === 'ar' ? 'جاري جلب التقارير من قاعدة البيانات...' : 'Fetching reports from database...'}</div>`;

  try {
    const snapshot = await getDocs(collection(db, "moa_documents"));
    let docs = [];
    snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));

    // Sort by year descending, then month descending
    docs.sort((a, b) => {
      if (b.year !== a.year) return (b.year || 0) - (a.year || 0);
      return (b.month || 0) - (a.month || 0);
    });

    window.allMoaDocs = docs;
    window.renderMoaReports = function(docsToRender) {
      const lang = document.documentElement.lang || 'ar';
      if (docsToRender.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 3rem; color: var(--muted);">${lang === 'ar' ? 'لا توجد نتائج مطابقة لبحثك' : 'No results found'}</div>`;
        return;
      }
      const displayDocs = docsToRender.slice(0, 60); // Show first 60 to keep UI fast
      container.innerHTML = displayDocs.map(d => `
        <div class="card" style="display:flex; flex-direction:column; background: #1c252c; border: 1px solid rgba(255,255,255,0.1);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem;">
            <span class="plot-pill" style="background:var(--oxford); color:white; font-family: monospace;">${d.type ? d.type.toUpperCase() : 'DOC'}</span>
            ${d.year ? `<span style="font-size: 0.7rem; color: var(--muted); font-family: monospace;">${d.year}${d.month ? ` - ${d.month}` : ''}</span>` : ''}
          </div>
          <h3 style="font-size: 0.95rem; margin-bottom: 0.5rem; line-height: 1.5; color: white;">${lang === 'ar' ? (d.titleAr || d.titleEn) : (d.titleEn || d.titleAr)}</h3>
          <p style="font-size: 0.7rem; color: var(--wheat); margin-bottom: 1.5rem; flex:1;">${d.catLabel || ''}</p>
          <a href="${d.url}" target="_blank" class="btn btn-outline btn-sm" style="text-align:center; text-decoration:none; display: block;" data-en="View Document" data-ar="عرض الملف">${lang === 'ar' ? 'عرض الملف' : 'View Document'}</a>
        </div>
      `).join('');
      if (typeof observeScrollElements === 'function') observeScrollElements(container);
    };

    window.renderMoaReports(docs);
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = window.allMoaDocs.filter(d => (d.titleAr && d.titleAr.toLowerCase().includes(term)) || (d.titleEn && d.titleEn.toLowerCase().includes(term)) || (d.catLabel && d.catLabel.toLowerCase().includes(term)));
        window.renderMoaReports(filtered);
      });
    }
  } catch (error) {
    console.error("Error fetching MoA docs:", error);
    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 3rem; color: #E76F51;">${lang === 'ar' ? 'حدث خطأ أثناء جلب البيانات.' : 'Error loading reports.'}</div>`;
  }
}

function setupAuth() {
  // 1. Inject Styles
  const style = document.createElement('style');
  style.innerHTML = `
    .auth-btn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 99px; padding: 0.3rem 0.8rem; font-size: 0.75rem; cursor: pointer; font-family: inherit; margin: 0 0.5rem; transition: background 0.2s; }
    .auth-btn:hover { background: rgba(255,255,255,0.2); }
    .auth-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 1000; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.3s ease; backdrop-filter: blur(4px); }
    .auth-modal.show { opacity: 1; pointer-events: auto; }
    .auth-content { background: #1c252c; width: 90%; max-width: 400px; border-radius: 16px; padding: 1.5rem; border: 1px solid rgba(255,255,255,0.1); position: relative; }
    .auth-close { position: absolute; top: 15px; right: 15px; background: none; border: none; color: white; font-size: 1.2rem; cursor: pointer; }
    html[dir="rtl"] .auth-close { right: auto; left: 15px; }
  `;
  document.head.appendChild(style);

  // 2. Inject Modal
  const modalHtml = `
    <div class="auth-modal" id="authModal">
      <div class="auth-content">
        <button class="auth-close" id="closeAuthBtn">✕</button>
        <h3 style="margin-top:0;" data-en="Account" data-ar="الحساب">Account</h3>
        <div id="authFormsContainer">
          <div id="emailAuthSection">
            <input type="email" id="authEmail" class="form-control" data-en="Email" data-ar="البريد الإلكتروني" placeholder="Email" style="margin-bottom:1rem;" />
            <input type="password" id="authPass" class="form-control" data-en="Password" data-ar="كلمة المرور" placeholder="Password" style="margin-bottom:1rem;" />
            <button class="btn btn-clay btn-full" id="loginBtn" data-en="Login" data-ar="دخول">Login</button>
            <button class="btn btn-outline btn-full" id="registerBtn" style="margin-top:0.5rem;" data-en="Create Account" data-ar="إنشاء حساب">Create Account</button>
            <button class="btn btn-outline btn-full" id="togglePhoneBtn" style="margin-top:0.5rem;" data-en="Login with Phone" data-ar="الدخول برقم الهاتف">Login with Phone</button>
          </div>
          <div id="phoneAuthSection" style="display:none;">
            <input type="tel" id="authPhone" class="form-control" placeholder="+9627XXXXXXXX" style="margin-bottom:1rem;" />
            <div id="recaptcha-container" style="margin-bottom:1rem;"></div>
            <button class="btn btn-clay btn-full" id="sendOtpBtn" data-en="Send Code" data-ar="إرسال الرمز">Send Code</button>
            <div id="otpSection" style="display:none; margin-top:1rem;">
              <input type="text" id="authOtp" class="form-control" placeholder="123456" style="margin-bottom:1rem;" />
              <button class="btn btn-clay btn-full" id="verifyOtpBtn" data-en="Verify Code" data-ar="تحقق من الرمز">Verify Code</button>
            </div>
            <button class="btn btn-outline btn-full" id="toggleEmailBtn" style="margin-top:0.5rem;" data-en="Back to Email" data-ar="العودة للبريد الإلكتروني">Back to Email</button>
          </div>
          <p id="authError" style="color:#E76F51; font-size:0.8rem; margin-top:1rem; display:none; text-align:center;"></p>
        </div>
        <div id="authProfile" style="display:none; text-align:center;">
          <img src="https://images.vexels.com/media/users/3/158109/isolated/preview/45554e769cf0539a21eb324928745d5b-plant-branch-icon.png" style="width: 56px; filter: brightness(0) invert(1); margin: 0 auto 1rem;" />
          <p id="userEmailDisplay" style="margin-bottom:1rem; color:var(--wheat);"></p>
          <button class="btn btn-outline btn-full" id="logoutBtn" data-en="Logout" data-ar="تسجيل الخروج">Logout</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Translate injected modal dynamically
  applyLanguage(document.documentElement.lang || 'ar');

  // 3. Inject Button in Header
  document.querySelectorAll('.header-actions').forEach(container => {
    const btn = document.createElement('button');
    btn.className = 'auth-btn';
    btn.textContent = 'Login';
    btn.onclick = () => {
      if (currentUser) {
        document.getElementById('authModal').classList.add('show'); // Show profile/logout
      } else {
        window.location.href = 'login.html'; // Redirect to new page
      }
    };
    container.insertBefore(btn, container.querySelector('.lang-btn'));
  });

  // 4. Logic & Event Listeners
  document.getElementById('closeAuthBtn').onclick = () => document.getElementById('authModal').classList.remove('show');
  
  const errOut = document.getElementById('authError');
  const emailIn = document.getElementById('authEmail');
  const passIn = document.getElementById('authPass');

  document.getElementById('loginBtn').onclick = async () => {
    errOut.style.display = 'none';
    try {
      await signInWithEmailAndPassword(auth, emailIn.value, passIn.value);
      document.getElementById('authModal').classList.remove('show');
    } catch (error) { errOut.textContent = error.message.replace('Firebase: ', ''); errOut.style.display = 'block'; }
  };

  document.getElementById('registerBtn').onclick = async () => {
    errOut.style.display = 'none';
    try {
      await createUserWithEmailAndPassword(auth, emailIn.value, passIn.value);
      document.getElementById('authModal').classList.remove('show');
    } catch (error) { errOut.textContent = error.message.replace('Firebase: ', ''); errOut.style.display = 'block'; }
  };

  document.getElementById('logoutBtn').onclick = () => signOut(auth);

  // Phone Authentication Logic
  let confirmationResult = null;

  document.getElementById('togglePhoneBtn').onclick = () => {
    document.getElementById('emailAuthSection').style.display = 'none';
    document.getElementById('phoneAuthSection').style.display = 'block';
    errOut.style.display = 'none';
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible'
      });
    }
  };

  document.getElementById('toggleEmailBtn').onclick = () => {
    document.getElementById('phoneAuthSection').style.display = 'none';
    document.getElementById('emailAuthSection').style.display = 'block';
    errOut.style.display = 'none';
  };

  document.getElementById('sendOtpBtn').onclick = async () => {
    errOut.style.display = 'none';
    let phoneNumber = document.getElementById('authPhone').value.trim();
    
    // Auto-format Jordanian numbers
    if (phoneNumber.startsWith('07')) {
        phoneNumber = '+962' + phoneNumber.substring(1);
    } else if (phoneNumber.startsWith('7')) {
        phoneNumber = '+962' + phoneNumber;
    }
    
    if (!phoneNumber.startsWith('+')) {
        errOut.textContent = (document.documentElement.lang === 'ar') ? "يجب إدخال رمز الدولة (+962)" : "Country code required (+962)";
        errOut.style.display = 'block';
        return;
    }

    const sendBtn = document.getElementById('sendOtpBtn');
    sendBtn.disabled = true;
    
    const appVerifier = window.recaptchaVerifier;
    try {
      confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      document.getElementById('otpSection').style.display = 'block';
      sendBtn.style.display = 'none';
    } catch (error) {
      errOut.textContent = error.message.replace('Firebase: ', '');
      errOut.style.display = 'block';
      sendBtn.disabled = false;
    }
  };

  document.getElementById('verifyOtpBtn').onclick = async () => {
    errOut.style.display = 'none';
    const code = document.getElementById('authOtp').value;
    try {
      await confirmationResult.confirm(code);
      document.getElementById('authModal').classList.remove('show');
      // Reset fields
      document.getElementById('authPhone').value = '';
      document.getElementById('authOtp').value = '';
    } catch (error) {
      errOut.textContent = error.message.replace('Firebase: ', '');
      errOut.style.display = 'block';
    }
  };

  // 5. Firebase Realtime Observer
  onAuthStateChanged(auth, async user => {
    currentUser = user;
    const lang = document.documentElement.lang || 'ar';
    document.querySelectorAll('.auth-btn').forEach(btn => {
       btn.textContent = user ? (lang === 'ar' ? 'حسابي' : 'Account') : (lang === 'ar' ? 'دخول' : 'Login');
    });

    if (user) {
      document.getElementById('authFormsContainer').style.display = 'none';
      document.getElementById('authProfile').style.display = 'block';
      document.getElementById('userEmailDisplay').textContent = user.email || user.phoneNumber;
      
      await migrateLocalDataToCloud(user);

      if (document.getElementById('plotList')) {
        unsubPlots = onSnapshot(query(collection(db, "users", user.uid, "plots"), orderBy("createdAt", "asc")), (snapshot) => {
           window.renderPlots(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
      }
      if (document.getElementById('journalList')) {
        unsubJournal = onSnapshot(query(collection(db, "users", user.uid, "journal"), orderBy("createdAt", "desc")), (snapshot) => {
           window.renderJournal(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
      }
    } else {
      document.getElementById('authFormsContainer').style.display = 'block';
      document.getElementById('authProfile').style.display = 'none';
      
      if (unsubPlots) { unsubPlots(); unsubPlots = null; }
      if (unsubJournal) { unsubJournal(); unsubJournal = null; }
      
      if (window.renderPlots) window.renderPlots([]);
      if (window.renderJournal) window.renderJournal([]);
    }
  });
}

setupLanguageToggle();
setupMenu();
setupPageTransitions();
setupAdvisorForm();
setupMyPlots();
setupJournal();
setupWeather();
setupMarketTrends();
setupInteractiveWidgets();
observeScrollElements();
setupFloralParallax();
setupChatbot();
setupMarketTicker();
setupAuth();
setupMoaReports();

function setupLoginPage() {
  const phoneInput = document.getElementById('pageAuthPhone');
  const sendBtn = document.getElementById('pageSendOtpBtn');
  const otpSection = document.getElementById('pageOtpSection');
  const otpInput = document.getElementById('pageAuthOtp');
  const verifyBtn = document.getElementById('pageVerifyOtpBtn');
  const errOut = document.getElementById('pageAuthError');
  const successOut = document.getElementById('pageAuthSuccess');
  const phoneSection = document.getElementById('phoneAuthPageSection');

  if (!phoneInput || !sendBtn) return; // Only execute if we are actually on login.html

  // Set the SMS language to match the user's selected language!
  auth.languageCode = document.documentElement.lang || 'ar';

  let confirmationResult = null;

  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'page-recaptcha-container', {
      'size': 'invisible'
    });
  }

  sendBtn.onclick = async () => {
    errOut.style.display = 'none';
    
    let phoneNumber = phoneInput.value.trim();
    // Auto-format Jordanian numbers if the user forgets the country code
    if (phoneNumber.startsWith('07')) {
      phoneNumber = '+962' + phoneNumber.substring(1);
    } else if (phoneNumber.startsWith('7')) {
      phoneNumber = '+962' + phoneNumber;
    }

    if (!phoneNumber.startsWith('+')) {
      errOut.textContent = (document.documentElement.lang === 'ar') ? "يجب أن يبدأ رقم الهاتف برمز الدولة (+962)" : "Phone must start with country code (+962)";
      errOut.style.display = 'block';
      return;
    }

    sendBtn.disabled = true;
    const originalText = sendBtn.textContent;
    sendBtn.textContent = (document.documentElement.lang === 'ar') ? "جاري الإرسال..." : "Sending...";

    const appVerifier = window.recaptchaVerifier;
    try {
      confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      otpSection.style.display = 'block';
      sendBtn.style.display = 'none';
      document.getElementById('page-recaptcha-container').style.display = 'none';
    } catch (error) {
      console.error("SMS Error:", error);
      errOut.textContent = error.message.replace('Firebase: ', '');
      errOut.style.display = 'block';
      
      sendBtn.disabled = false;
      sendBtn.textContent = originalText;

      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.render().then(widgetId => {
          window.grecaptcha.reset(widgetId);
        });
      }
    }
  };

  verifyBtn.onclick = async () => {
    errOut.style.display = 'none';
    const code = otpInput.value.trim();

    verifyBtn.disabled = true;
    const originalText = verifyBtn.textContent;
    verifyBtn.textContent = (document.documentElement.lang === 'ar') ? "جاري التحقق..." : "Verifying...";

    try {
      await confirmationResult.confirm(code);
      phoneSection.style.display = 'none';
      successOut.style.display = 'block';
      setTimeout(() => { window.location.href = "index.html"; }, 1500);
    } catch (error) {
      errOut.textContent = error.message.replace('Firebase: ', '');
      errOut.style.display = 'block';
      
      verifyBtn.disabled = false;
      verifyBtn.textContent = originalText;

      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.render().then(widgetId => {
          window.grecaptcha.reset(widgetId);
        });
      }
    }
  };
}
setupLoginPage();
