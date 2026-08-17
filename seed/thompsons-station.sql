-- Thompson's Station seed — city, 9 bodies, people, roles.
-- Rosters captured 2026-08-16 from the town website. Nonpartisan: no Party rows.
-- Idempotent: ON CONFLICT (id) DO NOTHING. Kreis White is one Person with two Roles.

BEGIN;

INSERT INTO "City" (
    id, name, name_en, name_municipality, name_municipality_en,
    timezone, status, "authorityType", language, realm, population,
    "updatedAt"
) VALUES (
    'thompsons-station',
    'Thompson''s Station',
    'Thompson''s Station',
    'Town of Thompson''s Station',
    'Town of Thompson''s Station',
    'America/Chicago',
    'supported',
    'municipality',
    'en',
    'us',
    7485,
    NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO "AdministrativeBody" (id, name, name_en, type, "cityId", "updatedAt") VALUES
    ('thompsons-station-boma', 'Board of Mayor and Aldermen', 'Board of Mayor and Aldermen', 'council', 'thompsons-station', NOW()),
    ('thompsons-station-planning', 'Planning Commission', 'Planning Commission', 'committee', 'thompsons-station', NOW()),
    ('thompsons-station-bza', 'Board of Zoning Appeals', 'Board of Zoning Appeals', 'committee', 'thompsons-station', NOW()),
    ('thompsons-station-beer', 'Beer Board', 'Beer Board', 'committee', 'thompsons-station', NOW()),
    ('thompsons-station-econ-dev', 'Economic Development & Infrastructure Acceleration Board', 'Economic Development & Infrastructure Acceleration Board', 'committee', 'thompsons-station', NOW()),
    ('thompsons-station-utility', 'Utility Advisory Board', 'Utility Advisory Board', 'committee', 'thompsons-station', NOW()),
    ('thompsons-station-parks', 'Parks & Recreation Advisory Board', 'Parks & Recreation Advisory Board', 'committee', 'thompsons-station', NOW()),
    ('thompsons-station-joint-workshops', 'Joint Workshops', 'Joint Workshops', 'community', 'thompsons-station', NOW()),
    ('thompsons-station-special-events', 'Special Events', 'Special Events', 'community', 'thompsons-station', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Person" (id, name, name_en, name_short, name_short_en, "cityId", "updatedAt") VALUES
    ('thompsons-station-brian-stover', 'Brian Stover', 'Brian Stover', 'Stover', 'Stover', 'thompsons-station', NOW()),
    ('thompsons-station-shaun-alexander', 'Shaun Alexander', 'Shaun Alexander', 'Alexander', 'Alexander', 'thompsons-station', NOW()),
    ('thompsons-station-bob-whitmer', 'Bob Whitmer', 'Bob Whitmer', 'Whitmer', 'Whitmer', 'thompsons-station', NOW()),
    ('thompsons-station-kreis-white', 'Kreis White', 'Kreis White', 'White', 'White', 'thompsons-station', NOW()),
    ('thompsons-station-harry-king', 'Harry King', 'Harry King', 'King', 'King', 'thompsons-station', NOW()),
    ('thompsons-station-tara-rumpler', 'Tara Rumpler', 'Tara Rumpler', 'Rumpler', 'Rumpler', 'thompsons-station', NOW()),
    ('thompsons-station-sean-cagle', 'Sean Cagle', 'Sean Cagle', 'Cagle', 'Cagle', 'thompsons-station', NOW()),
    ('thompsons-station-trent-harris', 'Trent Harris', 'Trent Harris', 'Harris', 'Harris', 'thompsons-station', NOW()),
    ('thompsons-station-tom-stephenson', 'Tom Stephenson', 'Tom Stephenson', 'Stephenson', 'Stephenson', 'thompsons-station', NOW()),
    ('thompsons-station-sarah-alexander', 'Sarah Alexander', 'Sarah Alexander', 'Alexander', 'Alexander', 'thompsons-station', NOW()),
    ('thompsons-station-charles-starck', 'Charles Starck', 'Charles Starck', 'Starck', 'Starck', 'thompsons-station', NOW()),
    ('thompsons-station-mary-herring', 'Mary Herring', 'Mary Herring', 'Herring', 'Herring', 'thompsons-station', NOW()),
    ('thompsons-station-lori-clemons', 'Lori Clemons', 'Lori Clemons', 'Clemons', 'Clemons', 'thompsons-station', NOW()),
    ('thompsons-station-bryce-levet', 'Bryce Levet', 'Bryce Levet', 'Levet', 'Levet', 'thompsons-station', NOW()),
    ('thompsons-station-jeff-risden', 'Jeff Risden', 'Jeff Risden', 'Risden', 'Risden', 'thompsons-station', NOW()),
    ('thompsons-station-amy-griffin', 'Amy Griffin', 'Amy Griffin', 'Griffin', 'Griffin', 'thompsons-station', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Role" (
    id, "personId", "cityId", "administrativeBodyId",
    "isHead", name, name_en, "electedOrder", "updatedAt"
) VALUES
    ('thompsons-station-role-brian-stover-boma', 'thompsons-station-brian-stover', 'thompsons-station', 'thompsons-station-boma', true, 'Mayor', 'Mayor', 1, NOW()),
    ('thompsons-station-role-shaun-alexander-boma', 'thompsons-station-shaun-alexander', 'thompsons-station', 'thompsons-station-boma', false, 'Vice Mayor', 'Vice Mayor', 2, NOW()),
    ('thompsons-station-role-bob-whitmer-boma', 'thompsons-station-bob-whitmer', 'thompsons-station', 'thompsons-station-boma', false, 'Alderman', 'Alderman', 3, NOW()),
    ('thompsons-station-role-kreis-white-boma', 'thompsons-station-kreis-white', 'thompsons-station', 'thompsons-station-boma', false, 'Alderman', 'Alderman', 4, NOW()),
    ('thompsons-station-role-harry-king-boma', 'thompsons-station-harry-king', 'thompsons-station', 'thompsons-station-boma', false, 'Alderman', 'Alderman', 5, NOW()),
    ('thompsons-station-role-tara-rumpler-planning', 'thompsons-station-tara-rumpler', 'thompsons-station', 'thompsons-station-planning', true, 'Chair', 'Chair', 1, NOW()),
    ('thompsons-station-role-sean-cagle-planning', 'thompsons-station-sean-cagle', 'thompsons-station', 'thompsons-station-planning', false, 'Vice-Chair', 'Vice-Chair', 2, NOW()),
    ('thompsons-station-role-kreis-white-planning', 'thompsons-station-kreis-white', 'thompsons-station', 'thompsons-station-planning', false, 'Alderman member', 'Alderman member', 3, NOW()),
    ('thompsons-station-role-trent-harris-planning', 'thompsons-station-trent-harris', 'thompsons-station', 'thompsons-station-planning', false, NULL, NULL, 4, NOW()),
    ('thompsons-station-role-tom-stephenson-planning', 'thompsons-station-tom-stephenson', 'thompsons-station', 'thompsons-station-planning', false, NULL, NULL, 5, NOW()),
    ('thompsons-station-role-sarah-alexander-planning', 'thompsons-station-sarah-alexander', 'thompsons-station', 'thompsons-station-planning', false, NULL, NULL, 6, NOW()),
    ('thompsons-station-role-charles-starck-planning', 'thompsons-station-charles-starck', 'thompsons-station', 'thompsons-station-planning', false, NULL, NULL, 7, NOW()),
    ('thompsons-station-role-mary-herring-bza', 'thompsons-station-mary-herring', 'thompsons-station', 'thompsons-station-bza', true, 'Chair', 'Chair', 1, NOW()),
    ('thompsons-station-role-lori-clemons-bza', 'thompsons-station-lori-clemons', 'thompsons-station', 'thompsons-station-bza', false, NULL, NULL, 2, NOW()),
    ('thompsons-station-role-bryce-levet-bza', 'thompsons-station-bryce-levet', 'thompsons-station', 'thompsons-station-bza', false, NULL, NULL, 3, NOW()),
    ('thompsons-station-role-jeff-risden-bza', 'thompsons-station-jeff-risden', 'thompsons-station', 'thompsons-station-bza', false, NULL, NULL, 4, NOW()),
    ('thompsons-station-role-amy-griffin-bza', 'thompsons-station-amy-griffin', 'thompsons-station', 'thompsons-station-bza', false, NULL, NULL, 5, NOW())
ON CONFLICT (id) DO NOTHING;

SELECT kind, n FROM (
    SELECT 1 AS ord, 'city' AS kind, count(*)::int AS n FROM "City" WHERE id = 'thompsons-station'
    UNION ALL
    SELECT 2, 'bodies', count(*)::int FROM "AdministrativeBody" WHERE "cityId" = 'thompsons-station'
    UNION ALL
    SELECT 3, 'people', count(*)::int FROM "Person" WHERE "cityId" = 'thompsons-station'
    UNION ALL
    SELECT 4, 'roles', count(*)::int FROM "Role" WHERE "cityId" = 'thompsons-station'
    UNION ALL
    SELECT 5, 'kreis-white-roles', count(*)::int FROM "Role" WHERE "personId" = 'thompsons-station-kreis-white'
) counts
ORDER BY ord;

COMMIT;
