"""Feature transforms shared by ml/features.py (training) and scoring.py (serving), ai-ml-guide section 4.

Kept free of app imports so ml/ can load this file by path without FastAPI or Gemini installed.
"""
import numpy as np
import pandas as pd


def add_derived(df: pd.DataFrame) -> pd.DataFrame:
    """One site's daily rows sorted by date (date, apparent_tmax, precip_sum). Adds the derived features.

    heat_index is the day's max apparent temperature in F. The guide's Rothfusz from tmax and rh_max pairs the
    afternoon high with the dawn humidity and reads 15 to 20 F high (the 103 rule fired on 84% of summer days).
    Scoring passes the last 7 days plus tomorrow from the forecast and keeps the last row.
    """
    d = pd.to_datetime(df.date)
    doy = d.dt.dayofyear
    return df.assign(precip_3d=df.precip_sum.rolling(3, min_periods=1).sum(),
                     precip_7d=df.precip_sum.rolling(7, min_periods=1).sum(),
                     heat_index=df.apparent_tmax * 9 / 5 + 32,
                     month=d.dt.month,
                     doy_sin=np.sin(2 * np.pi * doy / 365.25),
                     doy_cos=np.cos(2 * np.pi * doy / 365.25))
