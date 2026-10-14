# 🏢 Rancang Bangun Platform Katalog Properti Terintegrasi AI Chatbot Berbasis Arsitektur RAG

Sebuah *Centralized Digital Catalog Hub* (Pusat Katalog Digital Terpusat) yang dikembangkan untuk mengatasi fragmentasi data inventaris properti dan mengotomatisasi interaksi pelanggan. Platform ini dilengkapi dengan asisten virtual 24/7 yang menggunakan arsitektur *Retrieval-Augmented Generation* (RAG) untuk memastikan setiap respons chatbot 100% faktual berdasarkan *knowledge-base* perusahaan.

## 🛠️ Tech Stack
Proyek ini mengadopsi arsitektur terpisah (*decoupled*) dengan pendekatan *Monorepo*:
*   **Back-End:** ASP.NET Core Web API.
*   **Front-End:** Solid.JS (Reaktivitas tinggi tanpa *Virtual DOM*).
*   **Database:** PostgreSQL.
*   **Vector Database:** `pgvector` (Pencarian semantik / *Cosine Similarity*).
*   **AI Orchestrator:** LangChain (Pemrosesan NLP & Pipeline RAG).

## 📂 Struktur Proyek
```text
Skripsi-Katalog-Chatbot/
│
├── Katalog.Api/       # Backend ASP.NET Core (REST API, EF Core, Vector Embeddings)
├── Katalog.Web/       # Frontend Solid.JS (UI/UX Katalog & Chat Widget)
└── README.md

```

## ✨ Fitur Utama (Functional Requirements)

### 👥 Guest / Calon Pembeli (Frictionless Experience)

* **No-Login Required:** Identifikasi sesi menggunakan *UUID* otomatis yang disimpan di *Local Storage*.


* **Katalog Interaktif:** Pencarian dan *filtering* unit properti berdasarkan lokasi, harga, fasilitas, dan ketersediaan secara *real-time*.


* **RAG Chatbot 24/7:** Asisten AI cerdas untuk tanya jawab spesifikasi properti tanpa risiko *hallucination*.


* **Persistent Chat History:** Riwayat obrolan tidak hilang meski peramban di-*refresh*.


* **Direct WA CTA:** Tautan langsung ke WhatsApp tim *marketing* untuk kelanjutan transaksi.



### 👔 Admin / Tim Marketing (Back-Office)

* **Manajemen Katalog (CRUD):** Tambah, edit, dan hapus proyek atau unit properti.


* **Live Status Update:** Ubah status unit (*Available, Booked, Sold*) secara instan.


* **Auto-Indexing Vector DB:** Setiap perubahan spesifikasi akan otomatis memicu ekstraksi teks (*chunking*), *embedding*, dan *re-indexing* ke dalam `pgvector` di latar belakang.



### 👑 Super Admin

* **Audit Trail:** Log aktivitas komprehensif terkait perubahan data (CRUD) oleh *marketing*.


* **Dashboard Analitik:** Statistik kunjungan, performa *cluster*, dan metrik interaksi *chatbot* harian.


* **Manajemen Akun:** Kontrol penuh atas akses tim *marketing* (Admin).



## 🚀 Setup & Instalasi (Development)

### 1. Setup Database (Docker)

Jalankan *container* PostgreSQL yang sudah dilengkapi dengan ekstensi `pgvector`:

```bash
docker run --name pgvector-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=rahasia -e POSTGRES_DB=PropertyDb -p 5432:5432 -d pgvector/pgvector:pg16

```

### 2. Setup Back-End (Katalog.Api)

Masuk ke direktori API dan jalankan migrasi database:

```bash
cd Katalog.Api
dotnet ef migrations add InitialCreate
dotnet ef database update
dotnet run

```

*Pastikan Anda telah mengisi `ApiKey` OpenAI pada file `appsettings.json`.*

### 3. Setup Front-End (Katalog.Web)

Masuk ke direktori web, instal dependensi, dan jalankan *server development*:

```bash
cd Katalog.Web
npm install
npm run dev

```

## 📝 Lisensi

Pengembangan proyek ini ditujukan untuk memenuhi tugas akhir / skripsi akademik.
