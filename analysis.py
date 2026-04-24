import pandas as pd
import matplotlib.pyplot as plt

# Încarcă datele
df = pd.read_csv("Master_Stats.csv")

# 1. Player Scores: Calculăm un index de eficiență
df['efficiency_score'] = (df['goals'] * 10) + (df['assists'] * 8) + (df['successfulPasses'] * 0.1) - (df['losses'] * 2)

# 2. Line-breaking: Cine avansează mingea cel mai des?
line_breakers = df.groupby('playerId')['successfulPassesToFinalThird'].sum().sort_values(ascending=False).head(5)

# 3. Ball Loss Zones (Risc): Cine pierde mingea periculos în propria jumătate?
risky_players = df.groupby('playerId')['dangerousOwnHalfLosses'].sum().sort_values(ascending=False).head(5)

# --- AFISARE REZULTATE ---
print("--- TOP LINE BREAKERS (Pase în treimea adversă) ---")
print(line_breakers)

print("\n--- TOP JUCĂTORI CU RISC (Pierderi periculoase) ---")
print(risky_players)

# 4. Vizualizare: Comparatie
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

line_breakers.plot(kind='bar', ax=ax1, color='green', title='Top Line Breakers')
risky_players.plot(kind='bar', ax=ax2, color='red', title='Top Risc (Pierderi Mingi)')

plt.tight_layout()
plt.show()