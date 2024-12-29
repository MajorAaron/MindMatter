# Pocket Article Manager

A web application that allows you to manage saved articles from Pocket. Built with Firebase (Hosting, Cloud Functions, and Firestore).

## Features

- View saved articles in a responsive grid layout
- Add new articles manually through a form interface
- Mark articles as read/unread
- Delete articles
- Integration with Pocket through Zapier webhooks
- Responsive design that works on mobile and desktop

## Tech Stack

- Firebase Hosting
- Firebase Cloud Functions
- Firebase Firestore
- Vanilla JavaScript
- HTML/CSS

## Project Structure


to seed the db call  cd functions && FIRESTORE_EMULATOR_HOST="localhost:8081" node seed.js