# OIBus

## Overall workflow

* The Engine is what holds everything together : its start method is like a pseudo-constructor, it creates and then stores every Protocol, Application that will be used to receive and treat the data.

* The index reads the config file, instanciates the unique Engine and runs its start method which will also create the CronJobs to call the onScan() methods on the right time and for the right points.

* The onScan() methods are what run the services : protocols' onScan() will make the data requests to the right data sources and store it in the queues ; applications' onScan will retrieve the data in their own queue to treat it however they need to.

## Build and deploy step

* To buid the client and the executable for each distribution run `npm run build`

* To release (should be run on the release branch after correct merge) run `npm version {major | minor |patch}` this will trigger a full build zip the content of each distribution folder and upload in S3 (you should have s3 credentials properly configured on the build machine) 
