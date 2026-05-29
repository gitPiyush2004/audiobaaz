/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        // Allow any Supabase project's public storage bucket.
        // Storage paths look like: https://<project>.supabase.co/storage/v1/object/public/listings/...
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        // Mock listing photos during UI development. Safe to keep enabled —
        // real listings will come from Supabase Storage.
        hostname: "picsum.photos",
      },
    ],
  },
};

export default nextConfig;
