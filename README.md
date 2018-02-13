# loadtest

Argument

    -d  Duration,
    -m  Mode 
        0 = no limit transactions per second
        n = n transaction per second
        -n = n transaction per second (poisson)
    -s  start sequence key
    -a  address example: localhost,8000,127.0.0.1,3000