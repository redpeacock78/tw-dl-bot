BEGIN{RS="frame="}
/Duration: /{
  match($0, /[0-2][0-3]:[0-5][0-9]:[0-5][0-9]/)
  TIME=substr($0, RSTART, RLENGTH)
  split(TIME, array, ":")
  Dura=array[1]*3600+array[2]*60+array[3]
  Start=systime()
  Old=-1
}
/time=/{
  match($0, /[0-2][0-3]:[0-5][0-9]:[0-5][0-9]/)
  Now=substr($0, RSTART, RLENGTH)
  split(Now, array1, ":")
  Prog=array1[1]*3600+array1[2]*60+array1[3]
  Ratio=int(Prog/Dura*100)
  if ( Ratio != Old ) {
    if ( Ratio % 1 == 0 ) {
      Current=systime()
      px=Current-Start
      Remain=""
      if ( Prog != 0 ) {
        rx=(Dura*px)/Prog-px
        Remain=sprintf(" ETA:%02d:%02d:%02d", int(int(rx)/3600), int(int(rx)/60)%60, int(rx)%60)
      }
      printf ("%s/%s(%s%)%s\n", Now, TIME, Ratio, Remain)
      system("")
    }
    Old=Ratio
  }
}
