# roostoo-leaderboard

Todo README.

## Deploy

Using nginx.

```sh
git clone https://github.com/eric15342335/roostoo-leaderboard
cd roostoo-leaderboard
pnpm install
pnpm build
mkdir -p /var/www/roostoo-leaderboard
cp -r build/* /var/www/roostoo-leaderboard/
```

`/etc/nginx/sites-available/default`:

```conf
location ~* ^/roostoo-leaderboard/_app/immutable/ {
    root /var/www;
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header X-Content-Type-Options nosniff;
}

location ~ ^/roostoo-leaderboard(/.*)?$ {
    root /var/www;
    try_files $uri $uri/ /roostoo-leaderboard/index.html;
}
```
