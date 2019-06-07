# OIBus

## Overall workflow

* The Engine is what holds everything together : its start method is like a pseudo-constructor, it creates and then stores every Protocol, Application that will be used to receive and treat the data.

* The index reads the config file, instanciates the unique Engine and runs its start method which will also create the CronJobs to call the onScan() methods on the right time and for the right points.

* The onScan() methods are what run the services : protocols' onScan() will make the data requests to the right equipments and store it in the queues ; applications' onScan will retrieve the data in their own queue to treat it however they need to.


