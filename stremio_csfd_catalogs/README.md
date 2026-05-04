# Stremio CSFD katalogy

Samostatny Home Assistant OS addon, ktery z tvych zdroju na CSFD vytvari vlastni Stremio katalogy. Addon umi obslouzit vic katalogu najednou, pro kazdy drzi vlastni cache a vystavuje je jako jeden Stremio addon s manifestem, katalogy a detailem filmu.

Po spusteni addon zpristupni hlavne:

- `http://<HA-IP>:7010/manifest.json` pro instalaci do Stremia nebo Nuvio
- `http://<HA-IP>:7010/` jako webovy rozcestnik pro spravu, diagnostiku a Trakt

## Co addon dela

- nacita katalogy z CSFD HTML seznamu a je pripraveny i na dalsi typy zdroju
- uklada seznamy a detailni metadata do lokalni cache, aby bezel rychle a zbytecne nepretizoval zdroj
- pro Stremio vraci `catalog` a `meta` endpointy
- snazi se ke kazdemu filmu dohledat i standardni filmove ID, aby melo vetsi sanci najit streamy z dalsich addon zdroju
- umi per katalog exportovat sparovane polozky do Trakt listu
- umi per katalog vynutit zobrazeni jen sparovanych filmu, pokud nechces v katalogu videt fallback tituly bez standardniho ID

## Jak se instaluje

1. Pridej GitHub repository `pixareltodo/haos` do Home Assistant Add-on Store.
2. Nainstaluj addon `Stremio CSFD katalogy`.
3. Vypln addon konfiguraci v HAOS, hlavne zdroje v `csfd_catalogs`.
4. Spust addon.
5. Do Stremia nebo Nuvio pridej manifest z adresy `http://<HA-IP>:7010/manifest.json`.
6. V detailu addonu v HAOS muzes pouzit i tlacitko pro otevreni weboveho rozcestniku addonu.

## Jak se spravuje

- zakladni addon konfigurace zustava v HAOS
- katalogy muzes navic upravovat i pres web addon rozhrani na `/admin/config/catalogs`
- web sprava zapisuje do stejneho sdileneho addon configu, nevznika zadna druha konfigurace
- po webove uprave katalogu udelej restart addonu v HAOS, aby se zmena plne propsala do behu
