import pandas as pd
import glob
import os
import json

folder_path = os.path.join(os.path.expanduser("~"), "Desktop", "Date - meciuri")
files = glob.glob(os.path.join(folder_path, "*.json"))

all_player_stats = []

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        match_name = os.path.basename(file)

        for player in data.get('players', []):
            # Extragem datele 'total' care sunt cele mai importante pentru hackathon
            stats = player.get('total', {})
            stats['playerId'] = player.get('playerId')
            stats['matchName'] = match_name
            all_player_stats.append(stats)

# Creăm tabelul centralizat
df = pd.DataFrame(all_player_stats)

# Salvează pentru a-l deschide în Excel/Tableau/PowerBI
df.to_csv("Master_Stats.csv", index=False)
print(f"Am procesat {len(df)} intrări de jucători. Tabelul a fost salvat.")