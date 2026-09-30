# Vaniki TSC TE244 Windows Printer Service Setup Guide
### (हिन्दी & English Instructions)

Yeh folder Windows PC me TSC TE244 thermal printer se direct 1-click stickers print karne ke liye hai.

---

## 📁 Is Folder Me Kya-Kya Hai?

| File | Kaam |
| :--- | :--- |
| **`setup.bat`** | **One-Click Installer** - Node.js check karta hai, Windows printer detect karta hai, auto-start configure karta hai aur service start kar deta hai. |
| **`test-print.bat`** | **Instant Test Print** - Double-click karte hi printer se test stickers nikalta hai (alignment aur ribbon test karne ke liye). |
| **`start-service.bat`** | **Manual Console** - Service ko visible black command prompt window me run karta hai (logs dekhne ke liye). |
| **`start-background.vbs`** | **Silent Runner** - Service ko background me bina kisi window ke run karta hai. |
| **`stop-service.bat`** | **Stop Service** - Service ko band karne ke liye. |
| **`local-printer-service.js`** | Core Node.js HTTP Server (`http://127.0.0.1:9191`). |
| **`raw-print.ps1`** | Windows Spooler RAW print engine (`winspool.drv`). |

---

## 🚀 Step-by-Step Setup (Sirf 2 Minute Ka Kaam)

### Step 1: Windows PC Me Folder Copy Karein
- Is pure `windows-printer-service` folder ko pen-drive ya zip karke apne Windows PC me daal lijiye.
- Isko kisi achhi jagah rakhein, jaise:
  `C:\vaniki-printer` ya apne Desktop par.

---

### Step 2: Printer USB Connect Karein
- TSC TE244 printer ko Windows PC ke USB port me lagayein aur power ON karein.
- Windows me printer driver installed hona chahiye (TSC official driver ya Seagull Scientific driver).
- Windows "Printers & scanners" me printer ka naam hona chahiye (jaise `TSC TE244` ya `TE244`).

---

### Step 3: `setup.bat` Ko Double-Click Karein
1. Folder ke andar jaakar **`setup.bat`** par double click karein (agar chahein toh Right-Click -> *Run as administrator* kar sakte hain).
2. Script automatically:
   - **Node.js** check karegi (agar nahi hoga toh `winget` se automatically install karegi ya link degi).
   - Connected **TSC printer** detect karegi.
   - **Windows Startup** me shortcut daal degi taaki computer jab bhi restart ho, service apne aap background me chalu ho jaye!
   - Desktop par **"Vaniki TSC Printer"** shortcut bana degi.
   - Port `9191` par service chalu kar degi!

---

### Step 4: Test Print Karein
- Folder me **`test-print.bat`** par double click karein.
- Aapke TSC TE244 printer se turant 1 pair test stickers print hokar bahar aayega!
- Agar sticker nikal gaya, matlab hardware, driver aur script 100% connect ho gaye!

---

### Step 5: Web Portal Se Live Print Karein
1. Apne Windows PC ke Chrome ya Edge browser me web portal kholein:
   👉 **`https://warehouse.vanikicrop.com`**
2. Inward / QR Print page par jayein.
3. Boxes select karke **"Print via TSC Direct"** button dabayein.
4. Bina kisi popup ya print dialog ke direct TSC printer se stickers nikalna shuru ho jayenge!

---

## ❓ Common Troubleshooting (Agar Koi Issue Aaye)

### 1. "Node.js not recognized"
- Agar automatic install na ho, toh browser me `https://nodejs.org/` par jakar **LTS Version** download karke install karein, fir `setup.bat` dubara chalayein.

### 2. Printer Ka Naam Alag Hai (e.g. "TSC TE-244" ya "TSC TTP-244 Pro")
- Script automatically kisi bhi printer ko detect kar leti hai jisme `TE244` ya `TSC` likha ho.
- Agar custom naam rakhna chahein, toh `local-printer-service.js` me line 8 par:
  `const CONFIG_PRINTER = 'Aapka_Printer_Naam';` likh sakte hain.

### 3. Check Service Status
- Browser me URL open karein: `http://127.0.0.1:9191/status`
- Response me `{"success": true, "status": "ready"}` aana chahiye.

---

## 🛠️ Auto-Start Kaise Kaam Karta Hai?
- `setup.bat` ek choti silent VBS script aapke Windows ke Startup folder me add karta hai:
  `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Vaniki-TSC-Printer.vbs`
- Iska fayda: Computer reboot ya power cut ke baad kisi ko dobara script chalane ki zaroorat nahi padegi &mdash; service automatically background me active rahegi!
