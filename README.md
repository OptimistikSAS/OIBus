# Koatest
# fTbus
## How fTbus works

###### fTbus uses a set of classes :


* Engine:  
  * one instance  
  * start method handles the initialization of all the applications and protocols and their connection  
  * also creates the CronJobs which call the onScan  
  * contains one array for all the queues, one array for the activeApplication and one array for the activeProtocols  

* Queue:  
  * one instance per application  
  * all queues are stored in a single Engine array  
  * provides encapsulation for an array of Objects containing data and metadata for each measured point:  
  * enqueue(), dequeue(), flush() and a length getter  
  * all queues are updated simultaneously with the receiving of a data response  

* Server:  
  * one instance

* Protocol: one instance per unique protocol  
*A parent class. Each protocol has its own class and specifications.*  
Every Protocol has:  
  * one array of equipments with one entry for each equipment using this protocol. Each entry contains the information and objects needed to connect with the equipment  
  * one onScan() method  
  * one connect() and one deconnect() method  

* Application: one instance per application  
*A parent class too.*  
Every application has:   
  * one Queue which is actually a reference to their specific Queue in the array from Engine.  
  * an applicationParameters object containing information to be used by the application  
  * one onScan() method  
  * one connect() and one deconnect() method  



index reads the config file, instanciates the unique Engine and runs its start method to create all Application and Protocol objects and the queues associated with them. the start method also creates the CronJobs which will trigger the onScan() methods on the protocols and applications.

The onScan() methods are what run the services : protocols will make data request to the right equipments and store it in the queue ; applications will retrieve the data in their own queue to treat it however they need to.