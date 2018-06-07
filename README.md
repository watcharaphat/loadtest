# loadtest

Argument

    -d  Duration,
    -m  Mode 
        0 = no limit transactions per second
        n = n transaction per second
        -n = n transaction per second (poisson)
    -s  start sequence key
    -a  can use address file example: ip.txt
            (ip.txt should contain all the ips of TM nodes like this : IP,PORT;IP,PORT;)
            (if not use address file, will automaticly discover the network)
