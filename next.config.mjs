/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },

  async redirects() {
    return [
      // Temporary: redirect root to launch page until full app is ready
      { source: '/', destination: '/launch.html', permanent: false },
    ];
  },
};

export default nextConfig;
