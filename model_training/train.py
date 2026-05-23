import os
import urllib.request
import pandas as pd
import numpy as np
import pickle
import json

DATASET_URL = "https://raw.githubusercontent.com/bapujik/dataSets/refs/heads/main/Bengaluru_House_Data.csv"
MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(MODEL_DIR, "Bengaluru_House_Data.csv")

def download_dataset():
    if not os.path.exists(CSV_PATH):
        print(f"Downloading dataset from {DATASET_URL}...")
        urllib.request.urlretrieve(DATASET_URL, CSV_PATH)
        print("Dataset downloaded successfully!")
    else:
        print("Dataset already exists locally.")

def convert_sqft_to_num(x):
    tokens = str(x).split('-')
    if len(tokens) == 2:
        try:
            return (float(tokens[0]) + float(tokens[1])) / 2.0
        except ValueError:
            return None
    try:
        return float(x)
    except ValueError:
        return None

def remove_price_outliers(df):
    """
    Remove properties that have price per square foot outside mean +/- 1 standard deviation
    for each specific location. This removes extreme outliers that skew the model.
    """
    df_out = pd.DataFrame()
    for key, subdf in df.groupby('location'):
        m = np.mean(subdf.price_per_sqft)
        st = np.std(subdf.price_per_sqft)
        reduced_df = subdf[(subdf.price_per_sqft > (m - st)) & (subdf.price_per_sqft <= (m + st))]
        df_out = pd.concat([df_out, reduced_df], ignore_index=True)
    return df_out

def remove_bhk_outliers(df):
    """
    Remove BHK pricing anomalies: for a given location, a 2 BHK home should not be priced
    higher than a 3 BHK home of similar square footage.
    """
    exclude_indices = np.array([])
    for location, location_df in df.groupby('location'):
        bhk_stats = {}
        for bhk, bhk_df in location_df.groupby('bhk'):
            bhk_stats[bhk] = {
                'mean': np.mean(bhk_df.price_per_sqft),
                'std': np.std(bhk_df.price_per_sqft),
                'count': bhk_df.shape[0]
            }
        for bhk, bhk_df in location_df.groupby('bhk'):
            stats = bhk_stats.get(bhk - 1)
            if stats and stats['count'] > 5:
                exclude_indices = np.append(exclude_indices, bhk_df[bhk_df.price_per_sqft < stats['mean']].index.values)
    return df.drop(exclude_indices, axis='index')

def train_model():
    print("Loading dataset...")
    df = pd.read_csv(CSV_PATH)
    
    print(f"Initial shape: {df.shape}")
    
    # 1. Drop unnecessary columns
    df2 = df.drop(['area_type', 'society', 'balcony', 'availability'], axis='columns')
    
    # 2. Drop rows with null values in core features
    df3 = df2.dropna()
    print(f"Shape after dropping null values: {df3.shape}")
    
    # 3. Clean size / BHK column
    df3 = df3.copy()
    df3['bhk'] = df3['size'].apply(lambda x: int(x.split(' ')[0]))
    
    # 4. Clean total_sqft
    df3['total_sqft'] = df3['total_sqft'].apply(convert_sqft_to_num)
    df3 = df3.dropna(subset=['total_sqft'])
    print(f"Shape after parsing total_sqft: {df3.shape}")
    
    # 5. Outlier Removal: Total Sqft per BHK must be >= 300
    df4 = df3[~(df3.total_sqft / df3.bhk < 300)]
    print(f"Shape after filtering sqft/bhk < 300: {df4.shape}")
    
    # 6. Add price per sqft for outlier detection (price is in Lakhs, so * 100,000)
    df4 = df4.copy()
    df4['price_per_sqft'] = df4['price'] * 100000 / df4['total_sqft']
    
    # 7. Remove price_per_sqft outliers per location
    df5 = remove_price_outliers(df4)
    print(f"Shape after removing price_per_sqft outliers: {df5.shape}")
    
    # 8. Remove BHK price anomalies
    df6 = remove_bhk_outliers(df5)
    print(f"Shape after removing BHK price outliers: {df6.shape}")
    
    # 9. Filter bathroom anomalies (bathrooms must be <= bhk + 2)
    df7 = df6[df6.bath < df6.bhk + 2]
    print(f"Shape after filtering bathroom anomalies: {df7.shape}")
    
    # 10. Clean locations: Group locations with < 10 data points under 'other'
    df7 = df7.copy()
    df7['location'] = df7['location'].apply(lambda x: x.strip())
    location_stats = df7.groupby('location')['location'].agg('count').sort_values(ascending=False)
    locations_less_than_10 = location_stats[location_stats <= 10]
    
    df7['location'] = df7['location'].apply(lambda x: 'other' if x in locations_less_than_10 else x)
    
    # We now have a clean dataset
    df8 = df7.drop(['size', 'price_per_sqft'], axis='columns')
    
    # Generate Location One-Hot Dummy Variables
    dummies = pd.get_dummies(df8.location, dtype=int)
    
    # Prepare training features (X) and target (y)
    # To prevent multi-collinearity, we drop one dummy column (e.g. 'other')
    # However, let's keep all dummies or drop 'other' explicitly to have stable regression
    X = pd.concat([df8.drop(['location', 'price'], axis='columns'), dummies.drop('other', axis='columns')], axis='columns')
    y = df8.price
    
    print(f"Training features shape: {X.shape}")
    
    # Train Linear Regression model
    from sklearn.model_selection import train_test_split
    from sklearn.linear_model import LinearRegression
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=10)
    
    model = LinearRegression()
    model.fit(X_train, y_train)
    
    train_score = model.score(X_train, y_train)
    test_score = model.score(X_test, y_test)
    print(f"Model trained successfully!")
    print(f"Training R^2 Score: {train_score:.4f}")
    print(f"Testing R^2 Score: {test_score:.4f}")
    
    # Export Pickle and Columns JSON
    pickle_path = os.path.join(MODEL_DIR, "bengaluru_house_prices_model.pkl")
    with open(pickle_path, 'wb') as f:
        pickle.dump(model, f)
    print(f"Model saved to {pickle_path}")
    
    columns = {
        'data_columns': [col.lower() for col in X.columns]
    }
    columns_path = os.path.join(MODEL_DIR, "columns.json")
    with open(columns_path, 'w') as f:
        json.dump(columns, f)
    print(f"Columns saved to {columns_path}")
    
    # Export JS/TS files directly to Frontend directory (for client-side zero-cost prediction)
    # We want a sorted list of unique locations for the dropdown
    unique_locations = sorted(list(df8.location.unique()))
    if 'other' in unique_locations:
        unique_locations.remove('other')
    unique_locations.append('other') # Keep 'other' at the end of the list
    
    # Coefficients Mapping
    # Intercept: model.intercept_
    # coef for total_sqft, bhk, bath
    coef_dict = {
        'intercept': float(model.intercept_),
        'coef_sqft': float(model.coef_[0]),
        'coef_bhk': float(model.coef_[1]),
        'coef_bath': float(model.coef_[2]),
        'location_coefs': {}
    }
    
    # Map coefficients for each location column
    # Location columns start from index 3 in X.columns
    for i, col in enumerate(X.columns[3:]):
        coef_dict['location_coefs'][col.lower()] = float(model.coef_[3 + i])
    
    # Save directly to Frontend directories if they exist, or create them
    frontend_data_dir = os.path.join(MODEL_DIR, "..", "frontend", "src", "data")
    os.makedirs(frontend_data_dir, exist_ok=True)
    
    locations_ts_path = os.path.join(frontend_data_dir, "locations.ts")
    with open(locations_ts_path, 'w', encoding='utf-8') as f:
        f.write("// Autogenerated from train.py. Do not edit manually.\n")
        f.write("export const locations: string[] = ")
        json.dump(unique_locations, f, indent=2)
        f.write(";\n")
    print(f"Frontend locations exported to {locations_ts_path}")
    
    model_data_ts_path = os.path.join(frontend_data_dir, "model_data.ts")
    with open(model_data_ts_path, 'w', encoding='utf-8') as f:
        f.write("// Autogenerated from train.py. Do not edit manually.\n")
        f.write("export interface ModelData {\n")
        f.write("  intercept: number;\n")
        f.write("  coef_sqft: number;\n")
        f.write("  coef_bhk: number;\n")
        f.write("  coef_bath: number;\n")
        f.write("  location_coefs: Record<string, number>;\n")
        f.write("}\n\n")
        f.write("export const modelData: ModelData = ")
        json.dump(coef_dict, f, indent=2)
        f.write(";\n")
    print(f"Frontend model data coefficients exported to {model_data_ts_path}")

if __name__ == "__main__":
    download_dataset()
    train_model()
