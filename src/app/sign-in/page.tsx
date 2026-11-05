import { Metadata } from "next";
import PaskibrakaAuthSplit from "@/components/PaskibrakaAuthSplit";

export const metadata: Metadata = {
  title: "Pendaftaran Akun PPI | Purna Paskibraka Indonesia Kabupaten Probolinggo",
  description: "Formulir pendaftaran akun resmi anggota dan panitia PPI Kabupaten Probolinggo",
};

export default function SignInRegisterPage() {
  return <PaskibrakaAuthSplit initialMode="REGISTER" redirectUrl="/dashboard" />;
}

