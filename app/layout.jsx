import "./globals.css";

export const metadata = {
  title: "Portal de Vacaciones NAVE",
  description: "Portal interno para solicitudes, aprobaciones y reportes de vacaciones."
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
