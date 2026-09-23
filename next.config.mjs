export default {
  experimental: {webpackBuildWorker:false,workerThreads:true,cpus:2},
  serverExternalPackages: ['pg'],
  outputFileTracingIncludes: {
    '/simulator': ['./simulator/index.html', './simulator/*.js'],
    '/simulator/[asset]': ['./simulator/*.js']
  },
  poweredByHeader: false,
  async headers() {return [{source:'/:path*',headers:[
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'X-Frame-Options',value:'SAMEORIGIN'},
    {key:'Referrer-Policy',value:'same-origin'},
    {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}
  ]}];}
};
