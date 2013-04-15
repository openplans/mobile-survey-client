#!/usr/bin/env python
#-*- coding:utf-8 -*-

import argparse
import csv
import shareabouts

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Upload address data to a Surveyor dataset')
    parser.add_argument('csvfile', help='the name of the input file')
    parser.add_argument('dskey', help='the api key for the dataset')
    parser.add_argument('-d', '--dataset', help='the dataset slug', default='cb3-survey')
    parser.add_argument('-y', '--lat', help='the lat field', default='ycoord')
    parser.add_argument('-x', '--lng', help='the lng field', default='xcoord')
    args = parser.parse_args()

    api = shareabouts.ShareaboutsApi(root='http://api.shareabouts.org/api/v1/')
    api.authenticate_with_key(args.dskey)
    dataset = api.account('openplans').dataset(args.dataset)
    places = dataset.places.fetch(visible='all')
    places_by_address = {place.get('address'): place for place in places}

    with open(args.csvfile, 'rU') as csvfile:
        reader = csv.reader(csvfile)
        headers = None
        for row in reader:
            if headers is None:
                headers = [header.lower() for header in row]
                continue

            place_data = dict(zip(headers, row))
            place_data['location'] = {
                'lat': place_data.pop(args.lat),
                'lng': place_data.pop(args.lng),
            }
            place_data['visible'] = place_data.get('visible', True)

            address = place_data['address']
            place = places_by_address.get(address)
            if place:
                print "Found place with address %r" % (address,)
                if any([place.get(key) != value for key, value in place_data.items()]):
                    print "Updating data for address %r" % (address,)
                    place.save(place_data)
                else:
                    print "No changes"
            else:
                print "Creating new place with address %r" % (address,)
                places.create(place_data)
