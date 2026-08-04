import pandas as pd
import json

db_path = 'ANDBANK_Normalized_DB.xlsx'

# 1. Niveles_Master
df_niv = pd.read_excel(db_path, sheet_name='Niveles_Master')
print("Niveles_Master cols:", df_niv.columns.tolist())

# 2. Cambios_Master
df_cam = pd.read_excel(db_path, sheet_name='Cambios_Master')
print("Cambios_Master cols:", df_cam.columns.tolist())

# 3. AA_Modelos_Master
df_aa = pd.read_excel(db_path, sheet_name='AA_Modelos_Master')
print("AA_Modelos_Master cols:", df_aa.columns.tolist())

# 4. Contribuidores_Master
df_con = pd.read_excel(db_path, sheet_name='Contribuidores_Master')
print("Contribuidores_Master cols:", df_con.columns.tolist())

# 5. VL_Master
df_vl = pd.read_excel(db_path, sheet_name='VL_Master')
print("VL_Master cols:", df_vl.columns.tolist())

