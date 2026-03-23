# roostoo-leaderboard

A SvelteKit dashboard for the [Roostoo 2026 SG vs. HK Quant Trading Hackathon (Universities) competition](https://luma.com/tqx5xvcy?tk=5OpRgP). Data is fetched by `fetcher.py` on the server-side periodically via a `crontab`, and then served as a single `data.json` file where the SvelteKit frontend can fetch and visualize the data client-side.

## Deploy

### Setting up the static frontend

```sh
git clone https://github.com/eric15342335/roostoo-leaderboard
cd roostoo-leaderboard
pnpm install
pnpm build
mkdir -p /var/www/roostoo-leaderboard
cp -r build/* /var/www/roostoo-leaderboard/
sudo chown -R www-data:www-data /var/www/roostoo-leaderboard/
```

## Setting up the fetcher backend

Preliminary testing:

```sh
python3 -c "import fetcher; fetcher.OUTPUT_PATH = 'static/data.json'; fetcher.main()"
pnpm build
pnpm preview
```

### Install

```sh
sudo mkdir -p /opt/roostoo-fetcher
sudo cp fetcher.py /opt/roostoo-fetcher/fetcher.py
sudo chown -R www-data:www-data /opt/roostoo-fetcher/
sudo chmod 755 /opt/roostoo-fetcher/fetcher.py
```

### Crontab

Install as `www-data` so it can write to the nginx web root:

```sh
sudo crontab -u www-data -e
```

Add this line:

```cron
*/15 * * * * /usr/bin/python3 /opt/roostoo-fetcher/fetcher.py >> /opt/roostoo-fetcher/fetcher.log 2>&1
```

Logs are written to `/opt/roostoo-fetcher/fetcher.log` via crontab stdout
redirection.

## nginx configuration

In `/etc/nginx/sites-available/default`, add these to your existing server block:

```nginx
location ~* ^/roostoo-leaderboard/_app/immutable/ {
    root /var/www;
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header X-Content-Type-Options nosniff;
}

location = /roostoo-leaderboard/data.json {
    root /var/www;
    add_header Cache-Control "public, max-age=60";
}

location ~ ^/roostoo-leaderboard(/.*)?$ {
    root /var/www;
    try_files $uri $uri/ /roostoo-leaderboard/index.html;
}
```

Since we are serving large JSON files, it is recommended to enable `gzip` compression in nginx:

```nginx
gzip on;
gzip_comp_level 6;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```
