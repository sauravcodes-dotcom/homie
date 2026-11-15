from app.database.demo_data import generate
from app.services.housing.geo import travel_to_campus


def test_demo_descriptions_quote_the_walk_time_shown_on_the_card():
    for row in generate(150):
        walk = travel_to_campus(row.latitude, row.longitude).walk_minutes
        assert f"About a {walk}-minute walk to campus" in row.description
