/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Temporary: redirect root to launch page until full app is ready
      { source: '/', destination: '/launch.html', permanent: false },
    ];
  },
};

export default nextConfig;
