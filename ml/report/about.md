# About the hazard index

Text for the dashboard's About page (Cam). Plain language, safe to paste as is.

## What the number means

Every site gets a hazard index from 0 to 10 for tomorrow. It answers one question: given tomorrow's forecast at this site, how likely is weather or ground conditions that can hurt a crew? A 7 means tomorrow looks riskier than 70% of the days the model was checked against. Next to the number are the three weather reasons that pushed it up, such as "3 day rain 111 mm" or "Gusts 49 km/h", so a crew lead can see why and argue with it.

## Where it comes from

A machine learning model (LightGBM) trained on nine years of history at our 50 power plant sites. It learned from the weather on each day and whether something went wrong nearby that day: a severe weather event recorded by NOAA within 40 km, a heat event in the same county, or an outdoor workplace injury reported to OSHA within 25 km. It was trained on 2016 to 2022 and tested on 2024, a year it never saw.

## How good it is

On 2024, compared with the rule a supervisor would write by hand (heat index over 103 F, more than 75 mm of rain in three days, or gusts over 60 km/h), the model catches more of the bad days and raises fewer false alarms. Full numbers are in the project README.

## What it is not

It is not an injury forecast and it cannot tell whether a particular crew was exposed. Its history is recorded by county and by day, some heat events are missed, and injury reports are located by zip code. Use it to decide which sites to look at first, then look.

## The briefing and photo tags

The 6 PM briefing (English and Spanish), the one-sentence explanation of each index, and the tags on crew hazard photos are written by Google's Gemini. Every number in a briefing is checked against the data it was given; if Gemini adds a number that is not in the data, the briefing is rewritten from a template instead.
