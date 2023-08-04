# air-service
Air Service for the TripTix system

touch Dockerfile

docker build -t air-service .

docker run -p 3000:3000 air-service