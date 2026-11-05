import { prisma } from "./prisma";
import { hashPassword } from "./security";
import { firebaseGet, ROADSHOW_RTDB_URL, UMUM_RTDB_URL } from "./firebase";

let isSeeded = false;

export async function ensureSeeded() {
  if (isSeeded) return;
  try {
    // 1. Ensure default LandingConfig exists
    const configCount = await prisma.landingConfig.count();
    if (configCount === 0) {
      await prisma.landingConfig.create({
        data: {
          id: "default",
          heroTitle: "GENERASI EMAS INDONESIA",
          heroSubtitle:
            "Purna Paskibraka Indonesia Kabupaten Probolinggo. Membangun Karakter Kedisiplinan, Kepemimpinan, dan Jiwa Nasionalisme Pemuda Masa Depan.",
          heroCtaText: "Visit Profile BPIP",
          heroCtaUrl: "https://paskibraka.bpip.go.id/dashboard",
          waAdminMerch: "6282228368042",
          bukberTitle: "BUKBER PPI KAB. PROBOLINGGO 2026",
          bukberDesc:
            "Ingatkah saat kita berpanas di bawah terik yang sama? Kini, saatnya kita duduk melingkar dalam sejuknya kekeluargaan. Bukan sekadar tentang menu berbuka, tapi tentang cerita yang takkan pernah usai.",
          bukberDate: "Sabtu, 28 Feb 2026 | 16:00 WIB - Selesai",
          bukberLocation: "SMKN 2 Kraksaan",
          bukberHtm: "Rp 30.000",
        },
      });
    }

    // 2. Ensure default Hierarchy Users (Super Admin, Admin, User) exist
    const userCount = await prisma.userAccount.count();
    if (userCount === 0) {
      await prisma.userAccount.createMany({
        data: [
          {
            username: "superadmin",
            passwordHash: hashPassword("AdityaSuper27!"),
            fullName: "Achmad Furqon Aditya Putra (Super Admin)",
            angkatan: "2023",
            role: "SUPER_ADMIN",
            permissions: JSON.stringify({
              manageLanding: true,
              manageMerchandise: true,
              manageReviews: true,
              manageRoadshow: true,
              manageVoting: true,
            }),
          },
          {
            username: "aditya",
            passwordHash: hashPassword("AdityaSuper27!"),
            fullName: "Aditya (Super Admin Utama)",
            angkatan: "2023",
            role: "SUPER_ADMIN",
            permissions: JSON.stringify({
              manageLanding: true,
              manageMerchandise: true,
              manageReviews: true,
              manageRoadshow: true,
              manageVoting: true,
            }),
          },
          {
            username: "admin_roadshow",
            passwordHash: hashPassword("RoadshowPPI27!"),
            fullName: "Admin Koordinator Roadshow",
            angkatan: "2024",
            role: "ADMIN",
            permissions: JSON.stringify({
              manageLanding: false,
              manageMerchandise: false,
              manageReviews: false,
              manageRoadshow: true,
              manageVoting: false,
            }),
          },
          {
            username: "admin_merch",
            passwordHash: hashPassword("MerchPPI27!"),
            fullName: "Admin KWH & Merchandise",
            angkatan: "2024",
            role: "ADMIN",
            permissions: JSON.stringify({
              manageLanding: false,
              manageMerchandise: true,
              manageReviews: false,
              manageRoadshow: false,
              manageVoting: false,
            }),
          },
          {
            username: "petugas_roadshow",
            passwordHash: hashPassword("PanitiaBBTB27!"),
            fullName: "Petugas Lapangan Roadshow (BB & TB)",
            angkatan: "2025",
            role: "USER",
            permissions: JSON.stringify({}),
          },
        ],
      });
    }

    // 3. Ensure default Landing Page items exist (from umum/index.html & kopsurat.html)
    const itemCount = await prisma.landingItem.count();
    if (itemCount === 0) {
      await prisma.landingItem.createMany({
        data: [
          // Roadshow Gallery
          {
            section: "ROADSHOW_GALLERY",
            title: "SMAN 1 PAITON",
            imageUrl: "/sman1paiton.jpeg",
            metaLocation: "Paiton",
            metaDay: "Kamis",
            metaDate: "27 Nov 2025",
            sortOrder: 1,
          },
          {
            section: "ROADSHOW_GALLERY",
            title: "SMAN 1 KRUCIL",
            imageUrl: "/sman1krucil.jpeg",
            metaLocation: "Krucil",
            metaDay: "Kamis",
            metaDate: "15 Des 2025",
            sortOrder: 2,
          },
          {
            section: "ROADSHOW_GALLERY",
            title: "SMAN 1 GADING",
            imageUrl: "/sman1gading.jpeg",
            metaLocation: "Gading",
            metaDay: "Kamis",
            metaDate: "15 Des 2025",
            sortOrder: 3,
          },
          {
            section: "ROADSHOW_GALLERY",
            title: "SMAN 1 GENDING",
            imageUrl: "/smanig.jpeg",
            metaLocation: "Gending",
            metaDay: "Kamis",
            metaDate: "08 Jan 2026",
            sortOrder: 4,
          },
          {
            section: "ROADSHOW_GALLERY",
            title: "MAN 2 Probolinggo",
            imageUrl: "/man2prob.jpeg",
            metaLocation: "Pajarakan",
            metaDay: "Jum'at",
            metaDate: "09 Jan 2026",
            sortOrder: 5,
          },
          {
            section: "ROADSHOW_GALLERY",
            title: "SMK SAQO",
            imageUrl: "/smksaqo.jpeg",
            metaLocation: "Kraksaan",
            metaDay: "Selasa",
            metaDate: "20 Jan 2026",
            sortOrder: 6,
          },
          {
            section: "ROADSHOW_GALLERY",
            title: "BBS HATI KRAKSAAN",
            imageUrl: "/bbshati.jpeg",
            metaLocation: "Kraksaan",
            metaDay: "Selasa",
            metaDate: "20 Jan 2026",
            sortOrder: 7,
          },
          // Merchandise
          {
            section: "MERCHANDISE",
            title: "Polo Official PPI",
            description: "Bahan Lacoste premium dengan bordir presisi tinggi khas Purna Paskibraka Indonesia.",
            price: "100.000",
            imageUrl: "/polo.png",
            sortOrder: 1,
          },
          {
            section: "MERCHANDISE",
            title: "Kaos Official PPI",
            description: "Bahan Cotton Combed 30s berkualitas tinggi, adem dan nyaman dipakai kegiatan lapangan.",
            price: "85.000",
            imageUrl: "/kaos.png",
            sortOrder: 2,
          },
          {
            section: "MERCHANDISE",
            title: "Seragam PSH PPI",
            description: "Pakaian Sipil Harian resmi organisasi dengan bahan drill eksklusif berkualitas tinggi.",
            price: "180.000",
            imageUrl: "/psh.png",
            sortOrder: 3,
          },
        ],
      });
    }

    // 4. Sync existing Firebase Reviews from umumDb (`paskab-c3eb4/penilaian`)
    const reviewCount = await prisma.review.count();
    if (reviewCount === 0) {
      const fbReviews = await firebaseGet<Record<string, any>>(UMUM_RTDB_URL, "penilaian");
      if (fbReviews && typeof fbReviews === "object") {
        const entries = Object.values(fbReviews);
        for (const r of entries) {
          if (r && r.nama && r.pesan) {
            await prisma.review.create({
              data: {
                nama: String(r.nama),
                kategori: String(r.kategori || "umum"),
                angkatan: String(r.angkatan || "-"),
                rating: Math.min(5, Math.max(1, Number(r.rating) || 5)),
                pesan: String(r.pesan),
                source: "LANDING",
                isVisible: true,
              },
            });
          }
        }
      }
      // If still 0, add 2 initial showcase reviews
      if ((await prisma.review.count()) === 0) {
        await prisma.review.createMany({
          data: [
            {
              nama: "Achmad Furqon Aditya Putra",
              kategori: "ppi",
              angkatan: "2023",
              rating: 5,
              pesan: "Sistem informasi PPI Kabupaten Probolinggo kini terintegrasi penuh dengan standar keamanan modern dan transparansi seleksi.",
              source: "LANDING",
            },
            {
              nama: "Peserta Seleksi SMAN 1 Paiton",
              kategori: "umum",
              angkatan: "-",
              rating: 5,
              pesan: "Proses pengumuman Roadshow sangat cepat, transparan, dan mudah dicek per sekolah!",
              source: "LANDING",
            },
          ],
        });
      }
    }

    // 5. Sync existing Roadshow Schools & Candidates from roadshowDb (`cwu-gen-2`)
    const schoolCount = await prisma.roadshowSchool.count();
    if (schoolCount === 0) {
      const [fbSchools, fbPeserta, fbPenilaian] = await Promise.all([
        firebaseGet<Record<string, any>>(ROADSHOW_RTDB_URL, "sekolah"),
        firebaseGet<Record<string, any>>(ROADSHOW_RTDB_URL, "peserta"),
        firebaseGet<Record<string, any>>(ROADSHOW_RTDB_URL, "penilaian"),
      ]);

      const schoolKeyToPrismaId: Record<string, string> = {};

      if (fbSchools && typeof fbSchools === "object") {
        for (const [fbKey, s] of Object.entries(fbSchools)) {
          if (s && s.namaSekolah) {
            const created = await prisma.roadshowSchool.create({
              data: {
                firebaseKey: fbKey,
                namaSekolah: String(s.namaSekolah),
                statusPenilaian: s.statusPenilaian === "Ditutup" ? "Ditutup" : "Dibuka",
              },
            });
            schoolKeyToPrismaId[fbKey] = created.id;
          }
        }
      }

      // If no schools in Firebase, seed default Probolinggo schools from the Roadshow list
      if (Object.keys(schoolKeyToPrismaId).length === 0) {
        const defaultSchools = [
          { namaSekolah: "SMAN 1 PAITON", lokasi: "Paiton", tanggal: "27 Nov 2025" },
          { namaSekolah: "SMAN 1 KRUCIL", lokasi: "Krucil", tanggal: "15 Des 2025" },
          { namaSekolah: "SMAN 1 GADING", lokasi: "Gading", tanggal: "15 Des 2025" },
          { namaSekolah: "SMAN 1 GENDING", lokasi: "Gending", tanggal: "08 Jan 2026" },
          { namaSekolah: "MAN 2 PROBOLINGGO", lokasi: "Pajarakan", tanggal: "09 Jan 2026" },
          { namaSekolah: "SMK SAQO KRAKSAAN", lokasi: "Kraksaan", tanggal: "20 Jan 2026" },
          { namaSekolah: "BBS HATI KRAKSAAN", lokasi: "Kraksaan", tanggal: "20 Jan 2026" },
        ];
        for (const ds of defaultSchools) {
          await prisma.roadshowSchool.create({
            data: {
              namaSekolah: ds.namaSekolah,
              lokasi: ds.lokasi,
              tanggal: ds.tanggal,
              statusPenilaian: "Dibuka",
            },
          });
        }
      }

      // Map penilaian by idPeserta
      const penilaianByPeserta: Record<string, any> = {};
      if (fbPenilaian && typeof fbPenilaian === "object") {
        for (const pen of Object.values(fbPenilaian)) {
          if (pen && pen.idPeserta) {
            penilaianByPeserta[String(pen.idPeserta)] = pen;
          }
        }
      }

      // Import peserta if present
      if (fbPeserta && typeof fbPeserta === "object") {
        const fallbackSchool = await prisma.roadshowSchool.findFirst();
        for (const [pKey, p] of Object.entries(fbPeserta)) {
          if (!p || !p.nama) continue;
          const targetSchoolId = schoolKeyToPrismaId[String(p.idSekolah)] || fallbackSchool?.id;
          if (!targetSchoolId) continue;
          const pen = penilaianByPeserta[pKey] || {};
          await prisma.roadshowCandidate.create({
            data: {
              firebaseKey: pKey,
              kodePeserta: String(p.kodePeserta || "PPI1"),
              nama: String(p.nama),
              jenisKelamin: p.jenisKelamin === "Cewek" ? "Cewek" : "Cowok",
              schoolId: targetSchoolId,
              beratBadan: Number(pen.beratBadan) || 0,
              tinggiBadan: Number(pen.tinggiBadan) || 0,
              hasilLulus: Boolean(pen.hasilLulus),
              statusTayang: Boolean(pen.statusTayang),
              keterangan: String(pen.keterangan || ""),
              updatedBy: String(pen.adminInput || "FirebaseSync"),
            },
          });
        }
      }
    }

    // 4. Ensure default Roadshow Posts (Berita & Agenda Kunjungan) exist
    const postCount = await prisma.roadshowPost.count();
    if (postCount === 0) {
      await prisma.roadshowPost.createMany({
        data: [
          {
            title: "SMKN 1 Kraksaan Jadi Titik Awal Roadshow Paskibraka Kabupaten Probolinggo 2026",
            category: "Kunjungan Selesai",
            status: "SUDAH_DIKUNJUNGI",
            schoolName: "SMKN 1 KRAKSAAN",
            location: "Kraksaan, Kab. Probolinggo",
            date: "04 AGUSTUS 2026",
            imageUrl: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1000",
            summary: "Kegiatan roadshow perdana sukses digelar dengan partisipasi lebih dari 120 siswa. Pengukuran tinggi dan berat badan serta wawasan kebangsaan terlaksana dengan khidmat.",
            content: "Purna Paskibraka Indonesia (PPI) Kabupaten Probolinggo mengawali rangkaian PPI Goes to School 2026 di SMKN 1 Kraksaan. Antusiasme para pelajar sangat tinggi dalam mengikuti sosialisasi tahapan seleksi calon anggota Paskibraka. Tim panitia lapangan melakukan pengukuran fisik awal sesuai standar BPIP, dilanjutkan pembekalan mental ideologi Pancasila.",
            sortOrder: 1,
            isPublished: true,
            author: "Penjab Roadshow",
          },
          {
            title: "Antusiasme Ratusan Pelajar SMAN 1 Paiton Ikuti Pengukuran Fisik Pra-Seleksi",
            category: "Kunjungan Selesai",
            status: "SUDAH_DIKUNJUNGI",
            schoolName: "SMAN 1 PAITON",
            location: "Paiton, Kab. Probolinggo",
            date: "08 JULI 2026",
            imageUrl: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1000",
            summary: "Sebanyak 85 calon peserta telah terdata melalui sistem barcode roadshow PPI. Seluruh berkas dan catatan fisik telah diverifikasi oleh tim penilai.",
            content: "Kunjungan roadshow di SMAN 1 Paiton berlangsung dinamis dan interaktif. Selain pengukuran tinggi dan berat badan, para siswa juga diberikan gambaran nyata mengenai kedisiplinan dan kebanggaan menjadi bagian dari pasukan pengibar bendera pusaka di tingkat kabupaten maupun nasional.",
            sortOrder: 2,
            isPublished: true,
            author: "Penjab Roadshow",
          },
          {
            title: "Sosialisasi Kedisiplinan dan Pra-Seleksi Paskibraka di SMAN 1 Gading Rampung Dilaksanakan",
            category: "Kunjungan Selesai",
            status: "SUDAH_DIKUNJUNGI",
            schoolName: "SMAN 1 GADING",
            location: "Gading, Kab. Probolinggo",
            date: "21 NOVEMBER 2025",
            imageUrl: "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1000",
            summary: "Tim Roadshow PPI Kabupaten Probolinggo menyelesaikan sesi sosialisasi dan penjaringan bakat kepemimpinan pemuda di kawasan Gading.",
            content: "Pelaksanaan di SMAN 1 Gading membuahkan hasil penjaringan talenta-talenta muda yang berpostur ideal dan memiliki semangat pengabdian tinggi. Seluruh calon peserta yang memenuhi kriteria telah dimasukkan ke dalam basis data pra-seleksi resmi.",
            sortOrder: 3,
            isPublished: true,
            author: "Penjab Roadshow",
          },
          {
            title: "Agenda Kunjungan PPI Roadshow Siap Sambangi SMKN 1 Kotaanyar Pekan Depan",
            category: "Agenda Kunjungan",
            status: "AKAN_DIKUNJUNGI",
            schoolName: "SMKN 1 KOTAANYAR",
            location: "Kotaanyar, Kab. Probolinggo",
            date: "05 DESEMBER 2026",
            imageUrl: "",
            summary: "Persiapan teknis dan koordinasi dengan pihak sekolah telah dimatangkan. Siswa kelas X dan XI dihimbau mempersiapkan fisik prima.",
            content: "Tim Penjab Roadshow PPI Kabupaten Probolinggo mengonfirmasi jadwal kunjungan ke SMKN 1 Kotaanyar. Acara akan dimulai pukul 08:00 WIB di aula sekolah, mencakup pemaparan alur seleksi nasional BPIP dan pengukuran standar fisik.",
            sortOrder: 4,
            isPublished: true,
            author: "Penjab Roadshow",
          },
          {
            title: "Persiapan Menuju Seleksi Kabupaten: Jadwal Kunjungan ke SMAN 1 Maron",
            category: "Agenda Kunjungan",
            status: "AKAN_DIKUNJUNGI",
            schoolName: "SMAN 1 MARON",
            location: "Maron, Kab. Probolinggo",
            date: "07 OKTOBER 2026",
            imageUrl: "",
            summary: "Rangkaian roadshow wilayah tengah segera berlanjut ke SMAN 1 Maron untuk menjaring calon putra-putri terbaik.",
            content: "Bagi para siswa yang berminat mengikuti seleksi Paskibraka Kabupaten Probolinggo 2027, persiapkan data diri dan latihan fisik dasar. Tim penilai PPI akan hadir langsung untuk memberikan arahan dan verifikasi awal.",
            sortOrder: 5,
            isPublished: true,
            author: "Penjab Roadshow",
          },
          {
            title: "Rangkaian Roadshow Wilayah Barat: SMKN 1 Dringu Siap Menyambut Tim PPI",
            category: "Agenda Kunjungan",
            status: "AKAN_DIKUNJUNGI",
            schoolName: "SMKN 1 DRINGU",
            location: "Dringu, Kab. Probolinggo",
            date: "08 JULI 2026",
            imageUrl: "",
            summary: "Wilayah Dringu menjadi salah satu fokus penjaringan calon paskibraka dengan antusiasme pendaftar yang tinggi.",
            content: "Penjab Roadshow bersama tim verifikator menjadwalkan kunjungan resmi ke SMKN 1 Dringu. Pengukuran tinggi dan berat badan serta penjelasan hak dan kewajiban peserta akan disampaikan secara transparan.",
            sortOrder: 6,
            isPublished: true,
            author: "Penjab Roadshow",
          },
        ],
      });
    }

    isSeeded = true;
  } catch (err) {
    console.error("Seed error:", err);
  }
}

