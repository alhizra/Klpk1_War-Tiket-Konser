/** @type {import('next').NextConfig} */
const nextConfig = {
  // API monolit di host lain (localhost:3000) — poster di-load lewat <img>
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
