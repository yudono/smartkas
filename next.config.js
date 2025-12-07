/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    '@xenova/transformers',
    '@huggingface/transformers',
    '@zilliz/milvus2-sdk-node',
    'sharp',
    'onnxruntime-node',
  ],
  webpack: (config) => {
    // Ignore node-specific modules when bundling for the browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      child_process: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
