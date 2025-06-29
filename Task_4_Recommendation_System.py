print("\nShrikant Kudale MIT ADT University B31 Batch - AI Internship Email- pixelreceives@gmail.com\n")
print("Task 4 - AI Internship : Interactive Content-Based Movie Recommendation System\n")

import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import requests
import io

# Load movie data from public dataset
url = "https://gist.githubusercontent.com/stungeye/a3af50385215b758637e73eaacac93a3/raw/movies.csv"
resp = requests.get(url)
df = pd.read_csv(io.StringIO(resp.text))
df = df[['original_title', 'genre', 'description', 'year']].dropna()
df.columns = ['title', 'genre', 'description', 'year']

# Show genre options to user
all_genres = sorted({g.strip() for genres in df['genre'] for g in genres.split(',')})
print("Select your preferred genres from the list below:\n")
for i, g in enumerate(all_genres, 1):
    print(f"[{i}] {g}")
choice = input("\nEnter genre numbers separated by commas (e.g. 1,3,6): ").strip()
selected = {all_genres[int(i)-1] for i in choice.split(',') if i.isdigit() and 1 <= int(i) <= len(all_genres)}

# Ask for recency and availability preferences
recency = input("\nDo you prefer [1] Old (before 2000), [2] New (2000+), or [3] Any? [1/2/3]: ").strip()
mtype = input("Availability preference: [T] Free or [R] Rented? (T/R): ").strip().upper()

# Apply filtering based on input
filtered = df[df['genre'].apply(lambda gs: any(g in selected for g in gs.split(',')))]
if recency == '1':
    filtered = filtered[filtered['year'] < 2000]
elif recency == '2':
    filtered = filtered[filtered['year'] >= 2000]

# Assume all movies are free for this demo
filtered['available'] = 'T'
filtered = filtered[filtered['available'] == mtype]

if filtered.empty:
    print("\n[!] No matching movies found. Please try different preferences.")
    exit()

# Transform text using TF-IDF and calculate cosine similarity
vectorizer = TfidfVectorizer(stop_words='english')
tfidf = vectorizer.fit_transform(filtered['description'])
cosine_sim = cosine_similarity(tfidf)

# Recommendation logic
def get_recommendations(index, top_n=5):
    similarity = list(enumerate(cosine_sim[index]))
    sorted_sim = sorted(similarity, key=lambda x: x[1], reverse=True)
    top = sorted_sim[1:top_n + 1]
    ids = [i for i, _ in top]
    scores = [round(s[1] * 100, 2) for s in top]
    return ids, scores

# Let user choose a reference movie
print("\n[>] Based on your preferences, select one movie to get recommendations:\n")
for i, t in enumerate(filtered['title'].values, 1):
    print(f"[{i}] {t}")
choice_idx = int(input("\nEnter your movie number: ").strip()) - 1
base_idx = filtered.index[choice_idx]
recommend_ids, similarity_scores = get_recommendations(filtered.index.get_loc(base_idx))

# Show final recommendations
print(f"\n--- Recommendations based on \"{filtered.loc[base_idx, 'title']}\" ---\n")
for i, (mid, score) in enumerate(zip(recommend_ids, similarity_scores), 1):
    title = filtered.iloc[mid]['title']
    year = filtered.iloc[mid]['year']
    print(f"{i}. {title} ({year}) — {score}% similar")

print("\n[✓] Recommendations complete. Enjoy your movie selection!")
