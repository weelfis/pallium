http {
    server {
        listen 80;
        server_name pallium.onrender.com;

        location / {
            root /path/to/client;
            index index.html;
        }

        location /register {
            proxy_pass https://pallium.onrender.com/register;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_ssl_verify on;
        }

        error_page 500 502 503 504 /50x.html;
        location = /50x.html {
            root /usr/share/nginx/html;
        }
    }
}