# Instructions

## Download ChromeDriver:

https://chromedriver.chromium.org/downloads

Extract the zip file and move the resulting chromedriver (for MacOS/Linux) or chromedriver.exe (for Windows) to this folder.

## Set your search area

Modify the SEARCH_ZIP and SEARCH_RADIUS in index.ts

## Install dependencies

* Install Node: https://nodejs.org/en/
* `npm install`

## Run

* `npm start`


# Notes

A Chrome window may repeatedly open, trying to acquire an appointment and closing if it can not find one.
Once an appointment is found, an alert will pop up and you will have roughly 10 minutes to fill out your information.

If you get a banner that says "We could not verify that you are a human" when scheduling your appointment, try resizing your window and submit again.

This script is set up to only look for Pfizers and Moderna vaccines. Feel free to modify if you want it to search for J&J/Janssen as well.
