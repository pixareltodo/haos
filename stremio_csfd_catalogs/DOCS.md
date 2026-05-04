# Stremio CSFD katalogy

## Co je to za addon

Addon prevadi jeden nebo vic vlastnich seznamu z CSFD na katalogy pro Stremio nebo Nuvio. Pro kazdy katalog drzi vlastni cache seznamu, detailu a match vysledku, aby se dalo na jednom addon serveru obslouzit vic tematickych katalogu najednou.

## Jak to funguje

1. addon nacte zdroj katalogu, typicky CSFD HTML seznam
2. z polozek vytahne zakladni metadata
3. prubezne doplni detail a podle moznosti i standardni filmove ID
4. vysledek ulozi do cache
5. vystavi katalog a detail pres Stremio endpointy

Pokud je povoleny Trakt nebo TMDB, addon je pouzije jen jako pomocne vrstvy pro sparovani a doplneni metadat. Samotny katalog i jeho detail stale vychazeji z konfigurace a cache addonu.

## Hlavni endpointy

- `/` hlavni rozcestnik a webova sprava
- `/manifest.json` instalacni manifest pro Stremio nebo Nuvio
- `/catalog/...` katalogove odpovedi pro Stremio
- `/meta/...` detail filmu nebo serialu
- `/health` rychla diagnostika behu a verze
- `/admin/csfd/status` a `/admin/csfd/matches/...` technicka diagnostika katalogu
- `/admin/config/catalogs` webova sprava katalogu
- `/admin/trakt` a `/admin/trakt/export/<catalogId>` Trakt autorizace a export

## Jak se instalace lisi podle mista

### V HAOS

V HAOS nastavujes hlavni addon konfiguraci, porty, kluce a zdroje. To je porad hlavni misto pro prvotni nasazeni addonu.

### Ve webovem rozhrani addonu

Ve webu addonu muzes pohodlne spravovat katalogy, jejich zdroje a filtry. Tyto zmeny se neukladaji do zadne druhe databaze, ale do stejneho sdileneho addon configu. Po webove zmene katalogu je potreba restart addonu v HAOS.

### Ve Stremio nebo Nuvio

Tam se addon nekonfiguruje. Jen se nainstaluje pres `manifest.json` a pak se pracuje s katalogy, ktere addon poskytuje.

## Trakt

Pro samotne sparovani filmu Trakt autorizace nutna neni. Potrebna je az ve chvili, kdy chces zapisovat polozky do sveho Trakt uctu, typicky pri exportu katalogu do Trakt listu.
